import { NOMINATIM_URL, TILE_ATTRIBUTION, TILE_URLS } from '@/utils/constants'

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

const readNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(read(value, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Trailing slashes would double up when a path is appended. */
const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

export const env = {
  /** Product name shown in the status pill. */
  title: read(import.meta.env.VITE_SENTRY_DASHBOARD_TITLE, 'SENTRY'),
  /** Basemap tile templates, per theme. */
  tileUrls: {
    light: read(import.meta.env.VITE_MAP_TILE_URL_LIGHT, TILE_URLS.light),
    dark: read(import.meta.env.VITE_MAP_TILE_URL_DARK, TILE_URLS.dark),
  },
  tileAttribution: read(import.meta.env.VITE_MAP_TILE_ATTRIBUTION, TILE_ATTRIBUTION),
  /**
   * Root of the monitoring API. Empty until the backend is deployed, in which
   * case the dashboard starts empty and reports "no source connected".
   */
  apiBaseUrl: trimTrailingSlash(read(import.meta.env.VITE_API_BASE_URL, '')),
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
