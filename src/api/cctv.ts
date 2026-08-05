import registryCapture from '@/data/cctv/registry.json'
import type { CameraRecord, CctvRegistryResponse } from '@/types/cctv'

/**
 * The camera registry, as the browser sees it.
 *
 * ## Why this does not go through `api/client.ts`
 *
 * That module wraps the Sentiry backend: it prefixes `VITE_API_BASE_URL`, and
 * `request()` throws immediately when no base URL is set. The camera endpoints are
 * **same-origin** — our own serverless functions, at a fixed path — so there is no
 * base URL to configure and nothing for `hasApi()` to gate. Routing them through
 * `client.ts` would mean the camera layer went dark whenever the unrelated Sentiry
 * backend was unconfigured, which is most of the time.
 *
 * ## The fixture switch is a probe, not a flag
 *
 * Everywhere else in this app the fixture decision is `hasApi()` — a build-time
 * environment value. It cannot be here: whether `/api/cctv` exists depends on the
 * host, not on our build. The same `dist` runs with live functions on Vercel and
 * Netlify, and with no functions at all under `vite preview` or on a plain bucket.
 *
 * So the first call finds out, and the answer is remembered for the session. A host
 * without functions serves `index.html` for `/api/cctv` — HTTP 200 with an HTML
 * body — so a status check alone is not enough; the content type has to be read too,
 * or the failure surfaces as a JSON parse error rather than as a missing endpoint.
 */

const REGISTRY_PATH = '/api/cctv'

/** Abandoned rather than left hanging behind a stalled upstream. */
const TIMEOUT_MS = 30_000

/** `null` until the first call has settled the question. */
let proxyAvailable: boolean | null = null

/** True once we know the deployment has no camera functions behind it. */
export const isUsingCameraFixture = (): boolean => proxyAvailable === false

export interface CameraBounds {
  west: number
  south: number
  east: number
  north: number
}

const capture = registryCapture as CctvRegistryResponse

/** Four decimals is ~10 m — far finer than a viewport needs, and keeps URLs short. */
const bbox = ({ west, south, east, north }: CameraBounds): string =>
  [west, south, east, north].map((value) => value.toFixed(4)).join(',')

/**
 * Cameras inside `bounds`.
 *
 * Duplicated from the server's own filter rather than shared, because the shared
 * module would have to be import-safe from three runtimes to save nine lines. The
 * wrap handling matters either way: a viewport crossing the antimeridian arrives
 * with `west` greater than `east`.
 */
function withinBounds(camera: CameraRecord, bounds: CameraBounds): boolean {
  if (camera.lat < bounds.south || camera.lat > bounds.north) return false

  const span = bounds.east >= bounds.west ? bounds.east - bounds.west : bounds.east - bounds.west + 360
  if (span >= 360) return true

  const offset = (((camera.lng - bounds.west) % 360) + 360) % 360
  return offset <= span
}

/**
 * The bundled capture, cut to the viewport.
 *
 * 92 cameras — central London plus the Balkans — so the layer is demonstrable with no
 * functions deployed. Its URLs still point at the real providers, which means the
 * *markers* work from the fixture but the *frames* do not: without the proxy there is
 * nothing to defeat CORS. The viewer reports that as an offline camera, which is
 * accurate, and the rail says why.
 */
function fromFixture(bounds: CameraBounds): CctvRegistryResponse {
  const cameras = capture.cameras.filter((camera) => withinBounds(camera, bounds))
  return { ...capture, cameras, regions: ['fixture'], failed: [] }
}

export async function fetchCameras(
  bounds: CameraBounds,
  { signal }: { signal?: AbortSignal } = {},
): Promise<CctvRegistryResponse> {
  if (proxyAvailable === false) return fromFixture(bounds)

  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  try {
    const response = await fetch(`${REGISTRY_PATH}?bbox=${bbox(bounds)}`, {
      signal: combined,
      headers: { Accept: 'application/json' },
      credentials: 'omit',
    })

    // A host with no functions rewrites this to index.html and answers 200 with
    // HTML, so the content type is the real test.
    const isJson = response.headers.get('content-type')?.includes('application/json') ?? false

    if (!response.ok || !isJson) {
      // 429 is the proxy working and refusing — not a missing endpoint. Falling back
      // to the fixture there would replace a live view with a stale one and never
      // retry, so the rate limit is surfaced as an empty refresh instead.
      if (response.status === 429) throw new Error('Camera registry rate limited')

      proxyAvailable = false
      return fromFixture(bounds)
    }

    proxyAvailable = true
    return (await response.json()) as CctvRegistryResponse
  } catch (cause) {
    // A cancellation the caller asked for is not a failure — let it through so the
    // thunk aborts quietly instead of marking the proxy dead on every pan.
    if (signal?.aborted) throw cause

    // Never seen a working response, and the request did not complete: treat the
    // endpoint as absent. Once it *has* answered, a single network blip must not
    // demote a live deployment to fixtures for the rest of the session.
    if (proxyAvailable === null) {
      proxyAvailable = false
      return fromFixture(bounds)
    }

    throw cause
  }
}

/** Where a camera's frame comes from. See `utils/cctv.ts`. */
export { buildFrameUrl } from '@/utils/cctv'
