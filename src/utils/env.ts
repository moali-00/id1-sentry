import { NOMINATIM_URL, TERRAIN_DEM_URL, TILE_ATTRIBUTION } from '@/utils/constants'

/**
 * Typed access to the build-time environment.
 *
 * Every `VITE_*` value is a string (or undefined) at runtime, and is inlined as
 * a literal during `vite build` — changing `.env` after a build has no effect.
 * Parsing happens once here so nothing else touches `import.meta.env`.
 *
 * The tile overrides exist for air-gapped deployments, where the public CARTO
 * basemaps are unreachable and tiles are served from an internal host.
 */

const read = (value: string | undefined, fallback: string): string => {
  const trimmed = (value ?? '').trim()
  return trimmed.length > 0 ? trimmed : fallback
}

/** An override that is absent, rather than one that falls back to a default. */
const readOptional = (value: string | undefined): string | null => {
  const trimmed = (value ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

const readNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(read(value, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Trailing slashes would double up when a path is appended. */
const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

export const env = {
  /** Product name shown in the status pill. */
  title: read(import.meta.env.VITE_SENTRY_DASHBOARD_TITLE, 'SENTRY'),
  /**
   * Raster tile templates that stand in for the light and dark **vector**
   * basemaps when set.
   *
   * Null by default, which means "load CARTO's published GL style". An
   * air-gapped host almost always serves plain raster tiles, so an override
   * switches that basemap from vector to raster rather than expecting the
   * internal host to publish a style document too.
   */
  tileUrls: {
    light: readOptional(import.meta.env.VITE_MAP_TILE_URL_LIGHT),
    dark: readOptional(import.meta.env.VITE_MAP_TILE_URL_DARK),
  },
  tileAttribution: read(import.meta.env.VITE_MAP_TILE_ATTRIBUTION, TILE_ATTRIBUTION),
  /**
   * Elevation tile template for the 3D terrain layer.
   *
   * Defaults to the public AWS Open Data bucket, which is keyless but carries no
   * SLA — so an internal DEM can be pointed at here. **Any replacement must be
   * terrarium-encoded**, since that is what the reader is configured for.
   */
  terrainUrl: read(import.meta.env.VITE_TERRAIN_URL, TERRAIN_DEM_URL),
  /**
   * Root of the monitoring API. Empty until the backend is deployed, in which
   * case the dashboard starts empty and reports "no source connected".
   */
  apiBaseUrl: trimTrailingSlash(read(import.meta.env.VITE_API_BASE_URL, '')),
  /**
   * Root of the Sentry Flight API — live ADS-B traffic around the island.
   *
   * A different service from `apiBaseUrl` with its own host, so it gets its own
   * variable rather than a path under the monitoring API. Unlike that one this
   * defaults to a working host, because there is no fixture to fall back on: an
   * aircraft layer with no source is an empty layer, where the basemap and
   * geocoder defaults above follow the same "works out of the box" rule.
   *
   * Set to an empty string to disable live traffic entirely.
   */
  flightApiBaseUrl: trimTrailingSlash(
    read(import.meta.env.VITE_FLIGHT_API_BASE_URL, 'https://id1-demo.elile.ai/sentry-api'),
  ),
  /** How often the activity feed re-fetches, in ms. */
  feedPollMs: readNumber(import.meta.env.VITE_FEED_POLL_MS, 30_000),
  /**
   * Public geocoder used for place-name search until the API owns `/geocode`.
   *
   * Set to an internal Nominatim (or compatible) instance on air-gapped
   * deployments, or to an empty string to disable name search entirely and
   * leave the search bar resolving coordinates and watch names only.
   */
  geocoderUrl: read(import.meta.env.VITE_GEOCODER_URL, NOMINATIM_URL),
} as const

/** True once an API root is configured; false means fixtures are in play. */
export const hasApi = (): boolean => env.apiBaseUrl.length > 0

/** True once a flight API root is configured; false disables the aircraft layer. */
export const hasFlightApi = (): boolean => env.flightApiBaseUrl.length > 0

/**
 * The flight stream's WebSocket URL, derived from the REST root.
 *
 * Derived rather than configured separately so the two can never disagree, and
 * upgraded to `wss:` alongside `https:` — a secure page cannot open an insecure
 * socket, so a mismatch here is a blocked connection with a console-only error.
 */
export const flightStreamUrl = (): string =>
  `${env.flightApiBaseUrl.replace(/^http/, 'ws')}/v1/stream`
