import { request } from '@/api/client'
import { MAX_ZOOM, MIN_ZOOM } from '@/utils/constants'
import { env, hasApi } from '@/utils/env'
import type { GeoResult } from '@/types/monitoring'

/**
 * Place-name search.
 *
 * Two providers, in priority order:
 *
 * 1. `GET {VITE_API_BASE_URL}/geocode?q=&limit=` once the backend owns it. This
 *    is the one that will eventually resolve internal place names too.
 * 2. A Nominatim-compatible endpoint (`VITE_GEOCODER_URL`, defaulting to
 *    OpenStreetMap's public instance) so name search works today, before that
 *    endpoint exists.
 *
 * Set `VITE_GEOCODER_URL` empty on an air-gapped deployment: the search bar
 * keeps resolving coordinate pairs and watch names locally and simply returns
 * no places.
 */

const RESULT_LIMIT = 6

/** The dashboard's own language, so place names read consistently with it. */
const RESULT_LANGUAGE = 'en'

/** Shape returned by Nominatim's `format=jsonv2`. */
interface NominatimResult {
  place_id: number
  lat: string
  lon: string
  name?: string
  display_name: string
  addresstype?: string
  /** `[south, north, west, east]`, as strings. */
  boundingbox?: [string, string, string, string]
}

/**
 * Pick a zoom that frames the result's bounding box.
 *
 * A country's box spans tens of degrees and a street's a fraction of one, so
 * deriving zoom from the span lands the camera at a sensible scale for each
 * instead of using one zoom for everything.
 */
function zoomForBounds(bbox: NominatimResult['boundingbox'], lat: number): number | undefined {
  if (!bbox) return undefined

  const [south, north, west, east] = bbox.map(Number)
  if ([south, north, west, east].some((value) => !Number.isFinite(value))) return undefined

  // Longitude degrees narrow towards the poles; scale them so the comparison
  // between the two spans is like-for-like.
  const latSpan = Math.abs(north - south)
  const lngSpan = Math.abs(east - west) * Math.cos((lat * Math.PI) / 180)
  const span = Math.max(latSpan, lngSpan)
  if (span <= 0) return MAX_ZOOM

  const zoom = Math.round(Math.log2(360 / span)) - 1
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

function toGeoResult(result: NominatimResult): GeoResult | null {
  const lat = Number(result.lat)
  const lng = Number(result.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  // `display_name` is a comma-separated hierarchy, finest first. The head is the
  // place, the tail is the context that disambiguates same-named places.
  const parts = result.display_name.split(',').map((part) => part.trim())
  const label = result.name?.trim() || parts[0] || result.display_name
  const context = parts.slice(1).join(', ') || (result.addresstype ?? 'Place')

  return { id: String(result.place_id), label, context, lat, lng, zoom: zoomForBounds(result.boundingbox, lat) }
}

async function geocodeViaNominatim(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const url = new URL(env.geocoderUrl)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', String(RESULT_LIMIT))
  // Without this the response follows the browser's Accept-Language and comes
  // back in the local script — "کراچی ڈویژن" rather than "Karachi Division",
  // which does not match the rest of this UI.
  url.searchParams.set('accept-language', RESULT_LANGUAGE)

  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Geocoder returned ${response.status}`)

  const results = (await response.json()) as NominatimResult[]
  return results.map(toGeoResult).filter((result): result is GeoResult => result !== null)
}

export function geocode(query: string, options: { signal?: AbortSignal } = {}): Promise<GeoResult[]> {
  const trimmed = query.trim()
  if (trimmed.length === 0) return Promise.resolve([])

  if (hasApi()) {
    return request<GeoResult[]>('/geocode', { signal: options.signal, params: { q: trimmed, limit: RESULT_LIMIT } })
  }

  if (env.geocoderUrl.length === 0) return Promise.resolve([])
  return geocodeViaNominatim(trimmed, options.signal)
}
