import { ApiError, request, type RequestOptions } from '@/api/client'
import { env, hasFlightApi } from '@/utils/env'
import type {
  FlightAircraft,
  FlightEnvelope,
  FlightRegion,
  FlightRegionConfig,
  FlightRegionUpdate,
  FlightTrackResponse,
} from '@/types/flights'

/**
 * Sentry Flight API — the REST half.
 *
 * The live map runs off the WebSocket in `./flightStream.ts`; these calls cover
 * what a socket is the wrong tool for: the one-off detail fetch behind a click,
 * and the position history behind a trail.
 *
 * There is no fixture fallback here, unlike the Sentiry endpoints. Frozen ADS-B
 * is not a degraded version of live ADS-B — a snapshot of aircraft that are no
 * longer there, presented as current traffic, is worse than an empty layer. With
 * no API configured the aircraft layer simply carries nothing.
 */

/** Every flight call targets the flight host rather than the monitoring API. */
const onFlightHost = (options: Omit<RequestOptions, 'baseUrl'> = {}): RequestOptions => ({
  ...options,
  baseUrl: env.flightApiBaseUrl,
})

export interface AircraftQuery {
  /** Viewport filter, `[west, south, east, north]` in degrees. */
  bbox?: [number, number, number, number]
  maxDistKm?: number
  minAlt?: number
  maxAlt?: number
  limit?: number
}

/**
 * All currently tracked aircraft, nearest the island first.
 *
 * Used for the initial paint and as the recovery path when the socket is down —
 * the stream's own snapshot covers the normal case.
 */
export async function fetchAircraft(
  query: AircraftQuery = {},
  options: Omit<RequestOptions, 'baseUrl' | 'params'> = {},
): Promise<FlightEnvelope> {
  return request<FlightEnvelope>('/v1/aircraft', {
    ...onFlightHost(options),
    params: {
      bbox: query.bbox ? query.bbox.join(',') : undefined,
      max_dist_km: query.maxDistKm,
      min_alt: query.minAlt,
      max_alt: query.maxAlt,
      limit: query.limit,
    },
  })
}

/**
 * One aircraft, with every enrichment the backend has resolved.
 *
 * Returns `null` on 404 rather than throwing. An aircraft leaving the region
 * mid-inspection is ordinary — it happens constantly — so the caller closing a
 * panel is normal control flow, not error handling.
 */
export async function fetchAircraftDetail(
  hex: string,
  options: Omit<RequestOptions, 'baseUrl' | 'params'> = {},
): Promise<FlightAircraft | null> {
  try {
    return await request<FlightAircraft>(`/v1/aircraft/${encodeURIComponent(hex)}`, onFlightHost(options))
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) return null
    throw cause
  }
}

/**
 * Recent position history for a trail, oldest first, up to 200 points.
 *
 * History is in-memory on the server and starts when the aircraft enters the
 * region, so a contact that just arrived legitimately has almost none. Also
 * returns `null` on 404, for the same reason as above.
 */
export async function fetchAircraftTrack(
  hex: string,
  since?: number,
  options: Omit<RequestOptions, 'baseUrl' | 'params'> = {},
): Promise<FlightTrackResponse | null> {
  try {
    return await request<FlightTrackResponse>(`/v1/aircraft/${encodeURIComponent(hex)}/track`, {
      ...onFlightHost(options),
      params: { since },
    })
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) return null
    throw cause
  }
}

/* ── Tracked region ───────────────────────────────────────────────────────── */

/** What the server is tracking right now. Free, no side effects. */
export async function fetchFlightRegion(
  options: Omit<RequestOptions, 'baseUrl' | 'params' | 'method'> = {},
): Promise<FlightRegionConfig> {
  return request<FlightRegionConfig>('/v1/config/region', onFlightHost(options))
}

/**
 * Repoint the tracked region.
 *
 * `lat`, `lon` and `radius_km` go together — the API has no partial update, so it
 * is impossible to leave a stale latitude paired with a new longitude.
 */
export async function setFlightRegion(
  region: { name: string; lat: number; lon: number; radiusKm: number },
  options: Omit<RequestOptions, 'baseUrl' | 'params' | 'method'> = {},
): Promise<FlightRegionUpdate> {
  return request<FlightRegionUpdate>('/v1/config/region', {
    ...onFlightHost(options),
    method: 'PUT',
    params: {
      lat: region.lat,
      lon: region.lon,
      radius_km: region.radiusKm,
      name: region.name,
      // The previously-tracked set belongs to a different place and would
      // otherwise linger on the map until each contact expired on its own.
      clear_state: 'true',
    },
  })
}

/** Distance, in degrees, within which the server's region counts as ours. */
const REGION_EPSILON_DEG = 0.01

/**
 * Make sure the server is tracking the island, and correct it if not.
 *
 * The region is one shared server-wide setting that any caller can change, so it
 * drifts. This dashboard exists to watch one target, so on startup it asserts
 * that target rather than rendering an empty layer over it — which is exactly what
 * happened when the region was found pointed at London.
 *
 * **It reads before it writes, and that is not just politeness.** A `PUT` clears
 * the tracked aircraft, so writing unconditionally would blank every client's map
 * on every dashboard load. The write happens only on a genuine mismatch.
 *
 * Returns the active region, or `null` if the check itself failed — in which case
 * the caller should carry on and stream whatever the server has, since an
 * unreachable config endpoint is no reason to show nothing.
 */
export async function ensureFlightRegion(
  target: { name: string; lat: number; lon: number; radiusKm: number },
  options: Omit<RequestOptions, 'baseUrl' | 'params' | 'method'> = {},
): Promise<{ region: FlightRegion; corrected: boolean } | null> {
  try {
    const current = await fetchFlightRegion(options)

    const matches =
      Math.abs(current.lat - target.lat) < REGION_EPSILON_DEG &&
      Math.abs(current.lon - target.lon) < REGION_EPSILON_DEG &&
      Math.abs(current.radius_km - target.radiusKm) < 1

    if (matches) return { region: current, corrected: false }

    const updated = await setFlightRegion(target, options)
    return { region: updated.region, corrected: true }
  } catch {
    return null
  }
}

/** Aircraft squawking 7500/7600/7700, or with a non-`none` emergency state. */
export async function fetchEmergencies(
  options: Omit<RequestOptions, 'baseUrl' | 'params'> = {},
): Promise<FlightEnvelope> {
  return request<FlightEnvelope>('/v1/emergencies', onFlightHost(options))
}

export { hasFlightApi }
