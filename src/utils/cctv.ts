import type { CameraRecord, CctvLiveMode, CctvOperationalStatus, CctvStreamType } from '../types/cctv.ts'

/**
 * Classifying what a camera actually delivers.
 *
 * Shared by the serverless registry in `api/` and by the browser, so that the
 * label the operator reads and the label the proxy assigned cannot drift apart.
 * Pure, no I/O, no DOM — see the note in `types/cctv.ts` about why the imports
 * here are relative.
 *
 * The rule this file exists to enforce: **a camera is only described as live if
 * we are actually receiving video.** Most "live traffic cameras" are stills on a
 * 20–60 second timer, and several sources hand us an HTML page and call it a feed.
 */

/* ── What kind of feed is this ────────────────────────────────────────────── */

const IMAGE_PATH = /\.(?:avif|gif|jpe?g|png|webp)(?:$|[?#])/i

/**
 * Endpoints that serve a frame without an image extension.
 *
 * `axis-cgi/jpg/image.cgi` is the Axis camera firmware's snapshot endpoint and is
 * everywhere; `traffic-images` is Singapore's; `campic` is ASFINAG's.
 */
const SNAPSHOT_ENDPOINT = /(?:axis-cgi\/jpg|camera\/snapshot|snapshot|campic|traffic-images)/i

/**
 * A camera *index* mistaken for a camera.
 *
 * Several agencies publish `.../api/v2/get/cameras` as both the list endpoint and,
 * in some records, the per-camera `url`. Proxying that returns a JSON array, so the
 * viewer would show a broken image where the honest answer is "no frame available".
 */
const CAMERA_INDEX_ENDPOINT = /\/api\/(?:v\d+\/)?(?:get\/)?cameras?(?:$|[?#])/i

/** Ottawa's `feed_url` is a viewer page, not a frame. */
const HTML_CAMERA_PAGE = /\/map\/camera(?:$|[?#])/i

/** Providers whose embed is a player page rather than a media file. */
const EMBED_PLAYER =
  /youtube\.com\/embed|youtube-nocookie\.com\/embed|rtsp\.me\/embed|ipcamlive\.com\/player|click2stream\.com|windy\.com\/webcams\/\d+\/embed/i

/** True when this URL plausibly returns image bytes rather than a document. */
export function isLikelySnapshotUrl(url?: string): boolean {
  if (!url) return false
  return (
    (IMAGE_PATH.test(url) || SNAPSHOT_ENDPOINT.test(url)) &&
    !CAMERA_INDEX_ENDPOINT.test(url) &&
    !HTML_CAMERA_PAGE.test(url)
  )
}

export function inferStreamType(url: string): CctvStreamType {
  if (/\.m3u8(\?|$)/i.test(url)) return 'hls'
  if (EMBED_PLAYER.test(url)) return 'iframe'
  return 'jpg'
}

/* ── Refresh cadence ─────────────────────────────────────────────────────── */

/** Used when a source publishes no cadence and we recognise nothing in its URL. */
const DEFAULT_REFRESH_SECONDS = 15

/**
 * Per-source snapshot cadence, in seconds.
 *
 * Measured against each source rather than guessed: re-fetching Alberta's stills
 * every 15s would be three wasted requests for every new frame, and polling an
 * Axis camera that updates continuously at 60s would show a minute-old picture
 * under a live label. Matched against the source name *and* the feed URL, because
 * some agencies are identifiable only by their CDN host.
 */
const CADENCE_RULES: [pattern: string, seconds: number][] = [
  ['511.alberta.ca', 60],
  ['alberta 511', 60],
  // Axis firmware serves a fresh frame on demand — the camera is the limit, not a timer.
  ['axis-cgi', 5],
  ['ottawa', 20],
  ['travelmidwest', 20],
  ['idot', 20],
  ['fl511', 30],
  ['511on', 30],
  ['wsdot', 20],
  ['caltrans', 20],
  ['cwwp2.dot.ca.gov', 20],
  ['jamcams', 60],
  ['tfl', 60],
  ['asfinag', 60],
  ['campic', 60],
  ['lta singapore', 60],
  ['data.gov.sg', 60],
  ['windy', 600],
]

export function inferRefreshIntervalSeconds(camera: Pick<
  CameraRecord,
  'refresh_interval_seconds' | 'source' | 'feed_url' | 'stream_url'
> | null): number {
  if (!camera) return DEFAULT_REFRESH_SECONDS

  const published = camera.refresh_interval_seconds
  if (typeof published === 'number' && Number.isFinite(published)) {
    // Floored at 5s. A source claiming faster than that would have us hammering
    // the proxy for frames the camera has not produced.
    return Math.max(5, Math.round(published))
  }

  const haystack = `${camera.source ?? ''} ${camera.feed_url ?? ''} ${camera.stream_url ?? ''}`.toLowerCase()
  for (const [pattern, seconds] of CADENCE_RULES) {
    if (haystack.includes(pattern)) return seconds
  }
  return DEFAULT_REFRESH_SECONDS
}

/* ── Delivery mode ───────────────────────────────────────────────────────── */

export function getLiveMode(camera: Pick<CameraRecord, 'live_mode' | 'stream_url' | 'feed_url'>): CctvLiveMode {
  if (camera.live_mode) return camera.live_mode
  if (camera.stream_url) return 'video'
  return camera.feed_url ? 'snapshot' : 'external'
}

/**
 * Settle what a record delivers, once, at the point it enters the registry.
 *
 * Returns null for a record with nothing to show, so the caller drops it rather
 * than plotting a marker that opens an empty viewer.
 *
 * The demotion in the middle is the important part: a `feed_url` that is not
 * plausibly an image becomes an `external_url`. Half a dozen agencies list a
 * viewer page in the field named for the image, and taking them at their word
 * produced cameras that were permanently "offline" — a false negative that reads
 * as a dead camera rather than as a provider we cannot proxy.
 */
export function normalizeCctvDelivery(camera: CameraRecord, capturedAt: string): CameraRecord | null {
  const next: CameraRecord = { ...camera }

  if (next.stream_url) {
    next.stream_type = next.stream_type ?? inferStreamType(next.stream_url)
    next.live_mode = 'video'
    return next
  }

  if (next.feed_url && !isLikelySnapshotUrl(next.feed_url)) {
    next.external_url = next.external_url ?? next.feed_url
    delete next.feed_url
  }

  if (next.feed_url) {
    next.stream_type = 'jpg'
    next.live_mode = 'snapshot'
    next.refresh_interval_seconds = inferRefreshIntervalSeconds(next)
    next.captured_at = capturedAt
    return next
  }

  if (next.external_url) {
    next.live_mode = 'external'
    return next
  }

  return null
}

/* ── Reading the state of a live viewer ──────────────────────────────────── */

/** Multiple of the cadence past which a snapshot is called stale rather than live. */
const STALE_CADENCE_MULTIPLE = 3

/** Floor on the stale threshold, so a 5s camera is not condemned after 15s. */
const STALE_FLOOR_SECONDS = 30

/**
 * What the viewer's status pill should say.
 *
 * `stale` exists so a snapshot that has stopped updating is distinguishable from
 * one that is merely between refreshes, and from a camera that is genuinely down.
 * A frozen picture under a LIVE label is the single most misleading thing this
 * feature could do.
 */
export function getCctvOperationalStatus({
  mode,
  loading,
  error,
  lastFrameAt,
  now,
  refreshIntervalSeconds = DEFAULT_REFRESH_SECONDS,
}: {
  mode: CctvLiveMode
  loading: boolean
  error: boolean
  lastFrameAt: number | null
  now: number
  refreshIntervalSeconds?: number
}): CctvOperationalStatus {
  if (error) return 'offline'
  if (loading || lastFrameAt === null) return 'connecting'

  if (mode === 'snapshot') {
    const limitMs = Math.max(STALE_FLOOR_SECONDS, refreshIntervalSeconds * STALE_CADENCE_MULTIPLE) * 1000
    if (now - lastFrameAt > limitMs) return 'stale'
  }

  return 'live'
}

/* ── Counting ────────────────────────────────────────────────────────────── */

export interface CctvModeCounts {
  all: number
  live: number
  nearLive: number
  external: number
}

export function countByMode(cameras: CameraRecord[]): CctvModeCounts {
  const counts: CctvModeCounts = { all: cameras.length, live: 0, nearLive: 0, external: 0 }
  for (const camera of cameras) {
    const mode = getLiveMode(camera)
    if (mode === 'video') counts.live += 1
    else if (mode === 'snapshot') counts.nearLive += 1
    else counts.external += 1
  }
  return counts
}

/**
 * Ranking used when cameras collide on the map and one must be drawn on top.
 *
 * Inline video beats a still, a fast still beats a slow one, and a camera we can
 * only link to comes last — that is the order of how much the operator gets from
 * clicking it.
 */
export function scoreDelivery(camera: CameraRecord): number {
  const mode = getLiveMode(camera)
  const transport = mode === 'video' ? 300 : mode === 'snapshot' ? 200 : 100
  const cadenceBonus = mode === 'snapshot' ? Math.max(0, 60 - inferRefreshIntervalSeconds(camera)) : 0
  return transport + cadenceBonus
}

/* ── The proxied frame URL ───────────────────────────────────────────────── */

/** Where the snapshot proxy lives. Same-origin, so no CORS and no mixed content. */
export const CCTV_FRAME_PATH = '/api/cctv-frame'

/**
 * The URL an `<img>` should load for this camera's current frame.
 *
 * Always same-origin: agency endpoints send no CORS headers, several are plain
 * `http://`, and some refuse a request without a referrer they recognise. The
 * `nonce` defeats both the browser cache and any intermediate one — without it a
 * refresh re-renders the identical bytes and the picture never changes.
 */
export function buildFrameUrl(feedUrl: string | undefined, refreshToken: number, now: number): string | null {
  if (!feedUrl) return null
  const nonce = `${now}-${refreshToken}`
  return `${CCTV_FRAME_PATH}?url=${encodeURIComponent(feedUrl)}&t=${encodeURIComponent(nonce)}`
}
