/**
 * Open-source camera feeds.
 *
 * ## Why this is a third type module
 *
 * `types/sentiry.ts` holds wire shapes the backend owns; `types/monitoring.ts`
 * holds view models we own. Cameras sit outside both, because the awkward wire
 * shapes here belong to **twenty-odd upstream road authorities**, not to one
 * backend — TfL sends `additionalProperties[]`, Caltrans nests the image URL four
 * levels deep, ASFINAG uses `wgs84_lat`. Those shapes stay local to the source
 * module that consumes them, in `api/_lib/sources/`.
 *
 * What is left is the contract of **our own** camera proxy, which we own at both
 * ends. `CameraRecord` is what `/api/cctv` publishes; `Camera` is that plus what
 * the map needs to draw it. There is no adapter between them worth the name —
 * pretending otherwise would be a function that copies fields.
 *
 * ## Not imported through `@/`
 *
 * This module and `utils/cctv.ts` are the two files shared between the browser
 * bundle and the serverless functions in `api/`. That bundle is built by Vercel's
 * own esbuild pass, which does not read our `paths` alias — so both files use
 * relative imports, and nothing here may touch a DOM type.
 */

/**
 * How a camera's pixels actually arrive.
 *
 * - `jpg` — a still, re-fetched on a cadence. The common case by a wide margin.
 * - `hls` — an `.m3u8` playlist, played inline.
 * - `iframe` — the provider's own player (YouTube, IPCamLive, rtsp.me), embedded.
 */
export type CctvStreamType = 'jpg' | 'hls' | 'iframe'

/**
 * What we can honestly promise the operator.
 *
 * The distinction is the whole point of this feature. A road authority's
 * "live camera" is very often a JPEG that changes once a minute, and drawing
 * that under a red LIVE dot is a lie about how current the picture is. So:
 *
 * - `snapshot` — a still image, labelled with its cadence and its age.
 * - `video` — a continuous stream we can play inline.
 * - `external` — the provider will not give us pixels at all, only a page.
 *
 * This mirrors `SourceHealth`'s `empty` vs `error`: the useful reading is not
 * "working / broken" but *what kind* of evidence this is.
 */
export type CctvLiveMode = 'snapshot' | 'video' | 'external'

/**
 * A camera as `/api/cctv` publishes it.
 *
 * At least one of `feed_url`, `stream_url` or `external_url` is always set —
 * `normalizeCctvDelivery` drops any record that has none, since a camera with no
 * way to see it is a dot that does nothing.
 */
export interface CameraRecord {
  id: string
  lat: number
  lng: number
  name: string
  /** Free text from the source — often a state or agency rather than a city. */
  city: string
  country: string
  /** Snapshot image URL. Fetched through `/api/cctv-frame`, never directly. */
  feed_url?: string
  /** HLS playlist or provider embed URL. */
  stream_url?: string
  stream_type?: CctvStreamType
  /** The provider's own page. Opened in a new tab; always a pointer, never proxied. */
  external_url?: string
  /** Seconds between snapshot refreshes. Set by `inferRefreshIntervalSeconds`. */
  refresh_interval_seconds?: number
  /** ISO timestamp the registry was assembled — the first frame's nominal age. */
  captured_at?: string
  live_mode?: CctvLiveMode
  /** Attribution. Shown verbatim in the viewer; it is whose camera this is. */
  source: string
}

/** What `/api/cctv` returns. */
export interface CctvRegistryResponse {
  cameras: CameraRecord[]
  /** Per-source counts, for the rail's provenance line. */
  sources: Record<string, number>
  /** Which region keys were queried, so a thin result can be explained. */
  regions: string[]
  /** Regions whose upstream failed outright, as opposed to returning nothing. */
  failed: string[]
  timestamp: string
}

/**
 * A camera on the map.
 *
 * `layerId` is fixed rather than a union: unlike the ITR feeds, every camera
 * belongs to the one `cctv` layer whatever country it came from. It is carried
 * anyway so `CameraMarker` can read its hue and tooltip copy out of the same
 * `DATA_LAYERS` registry every other marker uses.
 */
export interface Camera extends CameraRecord {
  layerId: 'cctv'
}

/** Where a camera's picture is in its lifecycle, for the viewer's status pill. */
export type CctvOperationalStatus = 'connecting' | 'live' | 'stale' | 'offline'
