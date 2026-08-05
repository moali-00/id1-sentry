import { parseBounds } from './bounds.ts'
import { buildRegistry } from './registry.ts'
import { clientKey, isRateLimited, safeFetch } from './ssrf.ts'

/**
 * The three camera endpoints, as Web-standard `Request` → `Response` handlers.
 *
 * Written against the platform rather than against a host's function signature so
 * the same code serves all three places it runs: a Vercel Node function, the Vite
 * dev server's middleware, and any future host. `node-adapter.ts` is the only
 * file that knows about `IncomingMessage`.
 *
 * ## Why these exist at all
 *
 * The dashboard is otherwise a static bundle and could be served from a bucket.
 * Cameras are the one thing that cannot be, for three separate reasons — any one
 * of which would be enough:
 *
 * 1. **CORS.** Not one of the road-authority endpoints sends
 *    `Access-Control-Allow-Origin`. A browser fetch of the registry fails before
 *    it starts.
 * 2. **Mixed content.** Several camera hosts are plain `http://`. A page served
 *    over HTTPS cannot load them at all, and there is no flag that changes that.
 * 3. **Hotlink protection and caching.** Some snapshot endpoints refuse a request
 *    without a referrer they recognise, and all of them need cache-busting to
 *    produce a new frame.
 */

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })

/* ── GET /api/cctv ───────────────────────────────────────────────────────── */

/**
 * Cameras for a viewport.
 *
 * `bbox=west,south,east,north` is the normal call. `regions=uk,japan` overrides
 * the geographic selection, and is what the fixture-capture script uses.
 *
 * Cached at the edge for five minutes with a ten-minute stale window. Camera
 * *positions* barely change; only frames are live, and those are a different
 * endpoint. Serving this from cache is what keeps a panning operator from
 * generating an upstream request per drag.
 */
export async function registryHandler(request: Request): Promise<Response> {
  if (isRateLimited(`cctv-registry:${clientKey(request)}`, 60, 60_000)) {
    return json({ error: 'Too many registry requests' }, 429)
  }

  const params = new URL(request.url).searchParams
  const bounds = parseBounds(params.get('bbox'))
  const regions = params.get('regions')?.split(',').map((key) => key.trim()).filter(Boolean)

  if (!bounds && !regions) {
    return json({ error: 'Pass bbox=west,south,east,north or regions=<keys>' }, 400)
  }

  try {
    const registry = await buildRegistry(bounds, regions)
    return json(registry, 200, {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    })
  } catch {
    return json({ error: 'Camera registry unavailable' }, 502)
  }
}

/* ── GET /api/cctv-frame ─────────────────────────────────────────────────── */

/** A camera frame past this size is not a frame. */
const MAX_FRAME_BYTES = 8 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = /^image\/(?:avif|gif|jpeg|png|webp)(?:;|$)/i

/**
 * One camera's current still, proxied.
 *
 * This is a fetch-anything primitive wearing our server's network identity, so it
 * is the most sensitive thing in the codebase. Four constraints, none optional:
 *
 * - **`safeFetch`**, so the URL cannot be pointed at cloud metadata or the private
 *   network, including through a redirect.
 * - **A rate limit.** Generous enough for several open viewers at a 5-second
 *   cadence, low enough that the proxy is not a free bandwidth amplifier.
 * - **An image content-type allowlist.** Without it this is an open proxy for
 *   arbitrary content served from our origin, which is a stored-XSS vector as well
 *   as an abuse one. `nosniff` goes on the response for the same reason.
 * - **A size cap**, checked twice: the declared `Content-Length` first, then the
 *   bytes actually received, because the header is a claim rather than a fact.
 */
export async function frameHandler(request: Request): Promise<Response> {
  if (isRateLimited(`cctv-frame:${clientKey(request)}`, 180, 60_000)) {
    return json({ error: 'Frame refresh limit reached' }, 429)
  }

  const source = new URL(request.url).searchParams.get('url')
  if (!source) return json({ error: 'Missing camera URL' }, 400)

  try {
    const upstream = await safeFetch(source, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.2',
        // Some Axis endpoints hand back a cached frame otherwise, and the picture
        // silently stops updating.
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'User-Agent': 'SentryDashboard/0.1 (+https://github.com/msiddique/id1x-sentry) camera-frame',
      },
    })

    if (!upstream.ok) return json({ error: 'Camera provider unavailable' }, 502)

    const contentType = upstream.headers.get('content-type') ?? ''
    if (!ALLOWED_IMAGE_TYPES.test(contentType)) {
      return json({ error: 'Camera source did not return an image' }, 415)
    }

    const declared = Number(upstream.headers.get('content-length') ?? 0)
    if (declared > MAX_FRAME_BYTES) return json({ error: 'Camera frame too large' }, 413)

    const frame = await upstream.arrayBuffer()
    if (frame.byteLength === 0) return json({ error: 'Camera returned an empty frame' }, 502)
    if (frame.byteLength > MAX_FRAME_BYTES) return json({ error: 'Camera frame too large' }, 413)

    return new Response(frame, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(frame.byteLength),
        // Never cached. The whole point of the request is that it is the current
        // frame, and the caller already varies the URL to be sure of it.
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    // Deliberately opaque. The message from `safeFetch` names what was blocked and
    // why, which would turn this endpoint into a network scanner that reports back.
    return json({ error: 'Camera frame could not be loaded' }, 502)
  }
}

/* ── GET /api/cctv-stream-status ─────────────────────────────────────────── */

/** What rtsp.me serves in place of the player when the owner's quota is spent. */
const RTSP_ME_EXHAUSTED = /temporarily limited|top up/i

/**
 * Whether an embedded player will actually play.
 *
 * Narrow on purpose: it answers for rtsp.me only. That provider returns HTTP 200
 * with a quota notice in the body when the camera owner's allowance runs out, so
 * the embed loads successfully and shows nothing. There is no way to detect that
 * from inside a cross-origin iframe — the browser will not let us read it — so the
 * check has to happen server-side.
 *
 * Everything else answers `available: null`, meaning "not knowable from here"
 * rather than "broken". The viewer treats the three cases differently.
 */
export async function streamStatusHandler(request: Request): Promise<Response> {
  if (isRateLimited(`cctv-status:${clientKey(request)}`, 60, 60_000)) {
    return json({ error: 'Too many status checks' }, 429)
  }

  const target = new URL(request.url).searchParams.get('url')

  if (!target || !/rtsp\.me\/embed/i.test(target)) {
    return json({ available: null, provider: null, reason: 'not-checkable' })
  }

  try {
    const response = await safeFetch(target, {
      signal: AbortSignal.timeout(8_000),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'SentryDashboard/0.1 (+https://github.com/msiddique/id1x-sentry) stream-check',
      },
    })

    if (!response.ok) return json({ available: false, provider: 'rtsp.me', reason: 'unreachable' })

    const body = await response.text()
    const exhausted = RTSP_ME_EXHAUSTED.test(body)

    return json(
      { available: !exhausted, provider: 'rtsp.me', reason: exhausted ? 'quota-exhausted' : null },
      200,
      { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    )
  } catch {
    return json({ available: null, provider: 'rtsp.me', reason: 'check-failed' }, 502)
  }
}
