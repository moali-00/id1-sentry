import type { CameraRecord } from '../../../src/types/cctv.ts'
import { asArray, cached, upstreamJson } from '../upstream.ts'
import { plottable } from './shared.ts'
import type { Bounds } from '../bounds.ts'

/**
 * Windy's webcam directory — the only global source in the port, and the only one
 * with any coverage of the region this dashboard actually watches.
 *
 * ## Why it is here
 *
 * Every other source is a road authority in Europe, North America, Singapore,
 * Japan or Australia. **None of them covers India**, and the ITR target on the
 * Odisha coast has no open camera network of its own: the nearest anything is on
 * the tourist coast around Puri, roughly 200 km south-west of the pad. A camera
 * layer without this source is a global capability with a hole exactly where the
 * subject of the product is.
 *
 * It is not a substitute for coverage that does not exist. Windy's Indian entries
 * are a handful of resort and city cams, and none of them looks at anything
 * relevant to a launch trial. What it buys is that the layer is not empty where
 * the map opens.
 *
 * ## Why it is optional
 *
 * It needs a key, and the product must stay demoable without one. With
 * `WINDY_API_KEY` unset this source reports nothing and the rest of the layer is
 * unaffected — the same posture as `VITE_API_BASE_URL` and the Sentiry fixtures.
 *
 * ## The catch worth knowing
 *
 * Free-tier preview image URLs **expire after ten minutes**. So a Windy snapshot
 * cannot be refreshed from a stale registry entry — once the token dies the frame
 * proxy gets a 403, and the viewer correctly reports the camera as offline. The
 * cadence is therefore declared as ten minutes rather than inferred, which keeps
 * the viewer from promising a refresh it cannot deliver.
 */

const API = 'https://api.windy.com/webcams/api/v3/webcams'

/** Free-tier image tokens die at ten minutes; there is no point polling faster. */
const PREVIEW_TTL_SECONDS = 600

/** Per request. Enough to populate a continental view without a huge payload. */
const LIMIT = 50

interface WindyWebcam {
  webcamId?: number
  title?: string
  status?: string
  location?: { city?: string; region?: string; country?: string; latitude?: number; longitude?: number }
  images?: { current?: { preview?: string; thumbnail?: string } }
  player?: { live?: string; day?: string }
}

interface WindyResponse {
  webcams?: WindyWebcam[]
}

export function fetchWindyCameras(bounds: Bounds | null): Promise<CameraRecord[]> {
  const key = process.env.WINDY_API_KEY?.trim()
  if (!key || !bounds) return Promise.resolve([])

  // Rounded to whole degrees for the cache key. A one-degree pan must not miss the
  // cache, and the bbox sent upstream is the rounded one for the same reason —
  // otherwise every pixel of drag is a distinct query.
  const north = Math.ceil(bounds.north)
  const east = Math.ceil(bounds.east)
  const south = Math.floor(bounds.south)
  const west = Math.floor(bounds.west)

  return cached(`windy:${north},${east},${south},${west}`, async () => {
    const url =
      `${API}?bbox=${north},${east},${south},${west}` +
      `&include=location,images,player&limit=${LIMIT}&categories=traffic,city,harbor,coast`

    const payload = await upstreamJson<WindyResponse>(url, { headers: { 'x-windy-api-key': key } })

    return asArray<WindyWebcam>(payload?.webcams)
      .filter((webcam) => webcam.status !== 'inactive')
      .map((webcam) => {
        const preview = webcam.images?.current?.preview
        const player = webcam.player?.live ?? webcam.player?.day

        return {
          id: `windy-${webcam.webcamId}`,
          lat: webcam.location?.latitude ?? NaN,
          lng: webcam.location?.longitude ?? NaN,
          name: webcam.title || 'Windy webcam',
          city: webcam.location?.city || webcam.location?.region || '',
          country: webcam.location?.country || '',
          // Prefer the still. The player is an iframe we cannot inspect, so a
          // snapshot with a known age is the more honest of the two.
          feed_url: preview,
          stream_url: preview ? undefined : player,
          stream_type: preview ? ('jpg' as const) : ('iframe' as const),
          external_url: webcam.webcamId ? `https://www.windy.com/webcams/${webcam.webcamId}` : undefined,
          refresh_interval_seconds: PREVIEW_TTL_SECONDS,
          source: 'Windy',
        } satisfies Partial<CameraRecord>
      })
      .filter(plottable)
  })
}
