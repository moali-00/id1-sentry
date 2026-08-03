import type { CategoryKey, WatchType } from '@/types/monitoring'

/**
 * Threat categories.
 *
 * The hues are deliberately theme-independent: an analyst who flips to light
 * mode must not have to re-learn the legend. They are mirrored as Tailwind
 * tokens (`--color-cat-*` in `index.css`) for static markup; the values here are
 * consumed where a colour is needed as a *value* — Leaflet `divIcon` HTML,
 * inline SVG fills and dynamically-tinted chips.
 */
export const CATEGORIES: Record<CategoryKey, { label: string; color: string }> = {
  political: { label: 'Political signalling', color: '#fbbf24' },
  military: { label: 'Military movement', color: '#60a5fa' },
  conflict: { label: 'Armed conflict', color: '#ff6467' },
  unrest: { label: 'Civil unrest', color: '#c27aff' },
  infra: { label: 'Infrastructure', color: '#2dd4bf' },
}

/** Stable iteration order for the legend and the collapsed rail. */
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[]

export const categoryColor = (key: CategoryKey): string => CATEGORIES[key].color

/** Selectable watch types, in the order the modal renders them. */
export const WATCH_TYPES: { key: WatchType; label: string }[] = [
  { key: 'keyword', label: 'Keyword' },
  { key: 'hashtag', label: 'Hashtag' },
  { key: 'account', label: 'Account' },
  { key: 'channel', label: 'Channel' },
  { key: 'region', label: 'Region' },
]

/** Swatch colour a newly-created watch inherits, keyed by its match type. */
export const TYPE_CATEGORY: Record<WatchType, CategoryKey> = {
  keyword: 'political',
  hashtag: 'unrest',
  account: 'military',
  channel: 'infra',
  region: 'conflict',
}

export const MATCH_PLACEHOLDER: Record<WatchType, string> = {
  keyword: 'e.g. mobilisation, convoy, checkpoint',
  hashtag: 'e.g. #border, #protest, #logistics',
  account: 'e.g. @border_watch_44',
  channel: 'e.g. t.me/state_briefs',
  region: '',
}

export const ALL_PLATFORMS = ['Telegram', 'X', 'VK', 'Facebook', 'Reddit']

/** How many platform chips show before the "+N" expander. */
export const VISIBLE_PLATFORM_COUNT = 3

export const DATE_RANGES = ['Rolling · last 24h', 'Rolling · last 7d', 'Rolling · last 30d', 'Custom range…']

/** Defaults a fresh draft opens with. */
export const DEFAULT_PLATFORMS = ['Telegram', 'X', 'VK']

export type BasemapId = 'voyager' | 'light' | 'dark' | 'satellite'

export interface Basemap {
  id: BasemapId
  label: string
  url: string
  attribution: string
  /**
   * Whether markers sit on a pale surface. Drives their fill opacity — it
   * follows the *basemap*, not the chrome theme, because that is what the
   * markers are actually drawn on top of.
   */
  isLight: boolean
  /** CARTO serves from a/b/c/d; Esri does not use subdomains. */
  subdomains?: string
  /**
   * Whether the source offers `@2x` tiles, marked in the URL with `{r}`.
   *
   * These are 512px images drawn into a 256px slot, so on a HiDPI screen the
   * basemap renders at native resolution instead of being upscaled — the single
   * biggest difference between a crisp raster map and a soft one.
   */
  retina?: boolean
}

/**
 * Selectable basemaps.
 *
 * Voyager is the default because it is the most legible of the free rasters:
 * it keeps roads, borders and place labels at world zoom, where Positron drops
 * most of them and Dark Matter renders them at very low contrast. An analyst
 * should be able to tell *where* a marker is without zooming in.
 */
export const BASEMAPS: Record<BasemapId, Basemap> = {
  voyager: {
    id: 'voyager',
    label: 'Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    isLight: true,
    subdomains: 'abcd',
    retina: true,
  },
  light: {
    id: 'light',
    label: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    isLight: true,
    subdomains: 'abcd',
    retina: true,
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    isLight: false,
    subdomains: 'abcd',
    retina: true,
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    isLight: false,
  },
}

export const BASEMAP_IDS = Object.keys(BASEMAPS) as BasemapId[]

export const DEFAULT_BASEMAP: BasemapId = 'voyager'

/** Legacy aliases kept for the `VITE_MAP_TILE_URL_*` overrides. */
export const TILE_URLS = {
  light: BASEMAPS.light.url,
  dark: BASEMAPS.dark.url,
} as const

export const TILE_ATTRIBUTION = '&copy; OpenStreetMap &copy; CARTO'

/**
 * Default geocoder for place-name search.
 *
 * OpenStreetMap's public Nominatim: keyless, CORS-enabled, and already the same
 * data behind the CARTO basemaps this app loads. Its usage policy caps callers
 * at roughly one request a second, which the search bar's debounce respects.
 * Override with `VITE_GEOCODER_URL` to point at an internal instance.
 */
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

/** Opening view — clusters span EMEA, Asia and the Americas. */
export const INITIAL_VIEW = { center: [18, 40] as [number, number], zoom: 2 }

export interface ViewPreset {
  key: string
  label: string
  lat: number
  lng: number
  zoom: number
  /** Marks a theatre under active watch — drawn with a pulsing indicator. */
  hot?: boolean
}

/**
 * One-click camera positions.
 *
 * Deliberately theatres rather than countries: an analyst jumps to a region of
 * interest, then narrows by hand.
 */
export const VIEW_PRESETS: ViewPreset[] = [
  { key: 'global', label: 'Global', lat: 18, lng: 40, zoom: 2 },
  // The ITR target the Sentiry feeds watch. Zoom 9 frames the island and the
  // Chandipur complex together without losing the pad box.
  { key: 'itr', label: 'Abdul Kalam I.', lat: 20.9, lng: 87.04, zoom: 9, hot: true },
  { key: 'europe', label: 'Europe', lat: 50, lng: 15, zoom: 4 },
  { key: 'ukraine', label: 'Ukraine', lat: 49, lng: 32, zoom: 5 },
  { key: 'levant', label: 'Levant', lat: 32.5, lng: 36, zoom: 5 },
  { key: 'gulf', label: 'Gulf', lat: 26, lng: 52, zoom: 5 },
  { key: 'sahel', label: 'Sahel', lat: 14, lng: 15, zoom: 4 },
  { key: 'south-asia', label: 'South Asia', lat: 25, lng: 74, zoom: 4 },
  { key: 'east-asia', label: 'East Asia', lat: 30, lng: 118, zoom: 4 },
  { key: 'americas', label: 'Americas', lat: 12, lng: -80, zoom: 3 },
  { key: 'africa', label: 'Africa', lat: 2, lng: 22, zoom: 3 },
]

/** Zoom level the map flies to when a cluster or feed row is selected. */
export const FOCUS_ZOOM = 6

export const MIN_ZOOM = 1

/**
 * Deep enough to read a street. A cap of 12 stopped the map at roughly city
 * scale, which is what made it feel like it would not let you in.
 */
export const MAX_ZOOM = 18

/**
 * Fractional zoom step.
 *
 * Leaflet snaps to whole zoom levels by default, so every wheel notch is a
 * jump. A quarter-level step makes zooming feel continuous. Going all the way
 * to `0` would be smoother still, but raster tiles are then permanently scaled
 * between levels and go soft — this is the best compromise with raster tiles.
 */
export const ZOOM_SNAP = 0.25

/** Step for the +/- buttons and the keyboard, which want a coarser move. */
export const ZOOM_DELTA = 0.5
