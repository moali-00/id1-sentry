import type { CameraRecord, CctvRegistryResponse } from '../../src/types/cctv.ts'
import { normalizeCctvDelivery, scoreDelivery } from '../../src/utils/cctv.ts'
import { intersects, type Bounds } from './bounds.ts'
import { BALKANS } from './sources/balkans.ts'
import { fetchUkCameras } from './sources/uk.ts'
import { fetchWindyCameras } from './sources/windy.ts'

/**
 * The camera regions, and how a viewport turns into a set of upstream calls.
 *
 * ## Two regions, on purpose
 *
 * This is a capability, not a coverage product, and two sources already exercise
 * every path the layer has: **London** is a dense snapshot network (~900 cameras on a
 * 60-second timer), **the Balkans** is inline HLS video. A third road authority
 * proves nothing the first two do not, and each one added is another upstream to
 * notice when it dies — four of the reference implementation's regions were long
 * dead and nobody had spotted it, precisely because a long list hides a silent zero.
 *
 * Windy is the exception and is not a demonstration: it is the only global source and
 * the only one with any coverage of India, which is the region this dashboard
 * actually watches. It contributes nothing without a key.
 *
 * ## How a region is chosen
 *
 * By **rectangle intersection**, not by testing the map's centre point. Centre
 * testing is what the reference implementation did and it fails in the ordinary
 * case: a viewport framing the Channel is centred on water, so the UK never matches
 * and the layer comes back empty over the densest camera network in the set.
 */

interface Region {
  key: string
  /** What the region *covers*, not the extent of its cameras. */
  bounds: Bounds
  /** Bounds-aware, because the global source has to be told where to look. */
  load: (bounds: Bounds | null) => Promise<CameraRecord[]>
}

const REGIONS: Region[] = [
  // Density: roughly 900 TfL cameras across Greater London, all stills.
  { key: 'london', bounds: { west: -0.55, south: 51.25, east: 0.35, north: 51.72 }, load: fetchUkCameras },
  // Inline video: three border crossings under continuous HLS, plus three city cameras.
  { key: 'balkans', bounds: { west: 20, south: 41, east: 28.7, north: 45.2 }, load: () => Promise.resolve(BALKANS) },
  // Global, and last: the fallback that stops a viewport over an unwired region from
  // coming back empty. Only active with `WINDY_API_KEY` configured.
  { key: 'windy', bounds: { west: -180, south: -90, east: 180, north: 90 }, load: fetchWindyCameras },
]

const BY_KEY = new Map(REGIONS.map((region) => [region.key, region]))

export const REGION_KEYS = REGIONS.map((region) => region.key)

/** Regions whose coverage rectangle overlaps `bounds`. */
export function regionsFor(bounds: Bounds): string[] {
  return REGIONS.filter((region) => intersects(bounds, region.bounds)).map((region) => region.key)
}

/**
 * Drop cameras outside the viewport.
 *
 * A region is a coarse filter — asking for London returns all of London however small
 * the viewport inside it — so the fine cut happens here. It matters for payload size
 * as much as correctness.
 */
function withinBounds(camera: CameraRecord, bounds: Bounds): boolean {
  if (camera.lat < bounds.south || camera.lat > bounds.north) return false

  const span = bounds.east >= bounds.west ? bounds.east - bounds.west : bounds.east - bounds.west + 360
  if (span >= 360) return true

  const offset = (((camera.lng - bounds.west) % 360) + 360) % 360
  return offset <= span
}

/**
 * Deduplicate on the feed, not the id.
 *
 * Windy carries cameras that a road authority also publishes, so the same physical
 * camera can arrive twice under two ids and plot two markers in one place.
 *
 * **The whole URL, query string included.** The reference implementation compared
 * `url.split('?')[0]`, on the reasoning that a query string is usually a
 * cache-busting nonce. For a good number of providers it is the opposite — the
 * camera's entire identity, as `?id=1`…`?id=8` — so stripping it collapsed a whole
 * city into a single marker. Our own frame nonces are added downstream of this and
 * never appear here.
 *
 * The kept copy is the one that delivers most — see `scoreDelivery`.
 */
function deduplicate(cameras: CameraRecord[]): CameraRecord[] {
  const best = new Map<string, CameraRecord>()

  for (const camera of cameras) {
    const key = camera.stream_url ?? camera.feed_url ?? camera.external_url ?? camera.id

    const existing = best.get(key)
    if (!existing || scoreDelivery(camera) > scoreDelivery(existing)) best.set(key, camera)
  }

  return [...best.values()]
}

/**
 * Hard cap on what one response carries.
 *
 * London alone returns close to 900 cameras — more than the map can usefully draw as
 * DOM markers and more than is worth sending. When the cap bites the highest-scoring
 * cameras survive and `truncated` reports the count that did not, because silently
 * returning the first 400 reads as full coverage when it is not.
 */
const MAX_CAMERAS = 400

export interface RegistryResult extends CctvRegistryResponse {
  /** How many cameras the cap discarded. Absent when nothing was dropped. */
  truncated?: number
}

/** Fetch, filter and assemble a response for one viewport. */
export async function buildRegistry(bounds: Bounds | null, requested?: string[]): Promise<RegistryResult> {
  const keys = requested?.filter((key) => BY_KEY.has(key)) ?? (bounds ? regionsFor(bounds) : REGION_KEYS)

  const settled = await Promise.allSettled(keys.map((key) => BY_KEY.get(key)!.load(bounds)))

  const collected: CameraRecord[] = []
  const failed: string[] = []

  settled.forEach((result, index) => {
    /*
     * `allSettled`, and a named failure list. One source being down must not blank the
     * others — the same reasoning as `loadItr`. But a region that *failed* is a blind
     * spot and reads differently from one that legitimately had nothing in frame, so
     * it is reported rather than swallowed. The same distinction `SourceHealth` draws
     * between `error` and `empty`.
     */
    if (result.status === 'rejected') {
      failed.push(keys[index])
      return
    }
    collected.push(...result.value)
  })

  const capturedAt = new Date().toISOString()

  const normalized = deduplicate(collected)
    .filter((camera) => (bounds ? withinBounds(camera, bounds) : true))
    .map((camera) => normalizeCctvDelivery(camera, capturedAt))
    .filter((camera): camera is CameraRecord => camera !== null)

  const capped =
    normalized.length > MAX_CAMERAS
      ? [...normalized].sort((a, b) => scoreDelivery(b) - scoreDelivery(a)).slice(0, MAX_CAMERAS)
      : normalized

  const sources: Record<string, number> = {}
  for (const camera of capped) sources[camera.source] = (sources[camera.source] ?? 0) + 1

  return {
    cameras: capped,
    sources,
    regions: keys,
    failed,
    timestamp: capturedAt,
    ...(capped.length < normalized.length ? { truncated: normalized.length - capped.length } : {}),
  }
}
