import type { CategoryKey, WatchType } from '@/types/monitoring'

/**
 * Threat categories.
 *
 * The hues are deliberately theme-independent: an analyst who flips to light
 * mode must not have to re-learn the legend. They are mirrored as Tailwind
 * tokens (`--color-cat-*` in `index.css`) for static markup; the values here are
 * consumed where a colour is needed as a *value* — marker inline styles, inline
 * SVG fills, MapLibre paint expressions and dynamically-tinted chips.
 */
export const CATEGORIES: Record<CategoryKey, { label: string; color: string }> = {
  political: { label: 'Political signalling', color: '#fbbf24' },
  military: { label: 'Military movement', color: '#2b7fff' },
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
  /**
   * A MapLibre **vector** style document, or a raster tile URL template.
   *
   * Vector is preferred wherever it exists: labels stay upright and crisply
   * typeset at fractional zoom and under a pitched or globe camera, where a
   * raster tile is a flat picture that has to be stretched. Satellite imagery
   * has no vector equivalent, so it stays raster.
   */
  source: { kind: 'vector'; styleUrl: string } | { kind: 'raster'; url: string; tileSize: number }
  attribution: string
  /**
   * Whether markers sit on a pale surface. Drives their fill opacity — it
   * follows the *basemap*, not the chrome theme, because that is what the
   * markers are actually drawn on top of.
   */
  isLight: boolean
}

/**
 * Selectable basemaps.
 *
 * Dark Matter is the default, paired with the dark chrome. It is the quietest of
 * the four, which is the point: every marker, corridor and danger area on this map
 * is a bright hue, and they carry far better over a near-black basemap than over
 * a pale one. Voyager remains the most *legible* — it keeps roads, borders and
 * place labels at world zoom where the others drop or dim them — so it is one
 * click away for when the question is "where exactly is this".
 *
 * All four are keyless. CARTO publishes its GL styles at fixed URLs, and Esri's
 * World Imagery tiles need no token.
 */
export const BASEMAPS: Record<BasemapId, Basemap> = {
  voyager: {
    id: 'voyager',
    label: 'Voyager',
    source: { kind: 'vector', styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    isLight: true,
  },
  light: {
    id: 'light',
    label: 'Light',
    source: { kind: 'vector', styleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    isLight: true,
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    source: { kind: 'vector', styleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    isLight: false,
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite',
    source: {
      kind: 'raster',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      tileSize: 256,
    },
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    isLight: false,
  },
}

export const BASEMAP_IDS = Object.keys(BASEMAPS) as BasemapId[]

export const DEFAULT_BASEMAP: BasemapId = 'dark'

export const TILE_ATTRIBUTION = '&copy; OpenStreetMap &copy; CARTO'

/* ── Projection ──────────────────────────────────────────────────────────────
 *
 * `mercator` is the working projection and the default. It is what the dashboard
 * has always been, and it is the right one for the job an operator actually does:
 * reading a pad complex at z14, comparing a declared danger area against a
 * settlement, judging a bearing.
 *
 * `globe` earns its place at world zoom, where Mercator inflates the high
 * latitudes badly enough to misrepresent distance — and where a 3,800 km corridor
 * running south into the Indian Ocean is a curve, not a stripe.
 */

export type ProjectionId = 'mercator' | 'globe'

export const PROJECTIONS: { id: ProjectionId; label: string; hint: string }[] = [
  { id: 'mercator', label: 'Flat', hint: 'Web Mercator — the working projection for reading a target up close' },
  { id: 'globe', label: 'Globe', hint: 'A sphere. Honest about distance at world zoom, awkward up close' },
]

export const DEFAULT_PROJECTION: ProjectionId = 'mercator'

/**
 * Camera tilt applied when switching to the globe, in degrees.
 *
 * Small on purpose. A steep pitch over an ocean AOI mostly shows empty sky, and
 * the point of the tilt is to make the sphere read as one — not to fly the camera.
 */
export const GLOBE_PITCH = 14

/**
 * How far the camera may tilt, in degrees.
 *
 * MapLibre allows up to 85, which puts the horizon across the middle of the frame
 * and turns most of the viewport into sky. 75 is enough to look *along* a range
 * and read an extruded airspace volume against the coast behind it, while keeping
 * the map the subject.
 */
export const MAX_PITCH = 75

/* ── Terrain ─────────────────────────────────────────────────────────────────
 *
 * Elevation is off by default and stays that way. It costs a second tile pyramid
 * from a third-party bucket, and for most of what this dashboard shows — an ocean
 * danger area, a maritime warning boundary — there is no relief to read.
 *
 * Where it earns its place is the Odisha coast: the pad complex, the Chandipur
 * range and the settlements named in evacuation reporting are all within a few
 * metres of sea level, and seeing that is the point.
 */

/**
 * Keyless global DEM tiles from the AWS Open Data terrain set.
 *
 * `terrarium` encoding is **not** the spec default — that is `mapbox`, and reading
 * terrarium tiles as Mapbox RGB produces elevations that look plausible and are
 * wrong. The encoding is declared explicitly wherever this URL is used.
 */
export const TERRAIN_DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

/** The AWS terrarium set is 256px tiles up to z15. */
export const TERRAIN_TILE_SIZE = 256
export const TERRAIN_MAX_ZOOM = 15

/**
 * Vertical exaggeration.
 *
 * One. The frontend renders backend figures verbatim and performs no scoring; a
 * dramatised landscape would be the one place it editorialised, and it would do it
 * on the layer an operator is using to judge whether a coastal town sits inside a
 * declared danger area.
 */
export const TERRAIN_EXAGGERATION = 1

/**
 * Sky, horizon and atmosphere, per theme.
 *
 * Only meaningful under globe projection: `fog-*` requires 3D terrain and the
 * atmosphere halo is the sphere's own edge. The values are dark-first because
 * that is what a command surface is looked at in; the light pair keeps the halo
 * from reading as a smudge against a pale basemap.
 *
 * MapLibre draws the star field itself as part of the globe atmosphere — there is
 * no property for it, so `atmosphere-blend` is what makes it visible at all.
 */
export const SKY: Record<'light' | 'dark', Record<string, string | number>> = {
  dark: {
    /* Sky and fog are the page's own background steps — bg-root for the void and
       bg-elevated for the haze on the terrain — so the globe's edge dissolves into
       the surrounding canvas instead of sitting on it as a lighter disc. The
       horizon rim is the accent, which is what makes it read as instrumentation. */
    'sky-color': '#0d1117',
    'horizon-color': '#2b7fff',
    'fog-color': '#161b22',
    'sky-horizon-blend': 0.18,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.5,
    'atmosphere-blend': 0.9,
  },
  light: {
    'sky-color': '#a8ccf0',
    'horizon-color': '#dbe8f5',
    'fog-color': '#e8eef5',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.7,
    'fog-ground-blend': 0.5,
    'atmosphere-blend': 0.8,
  },
}

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

/**
 * The region the flight API is asked to track.
 *
 * That API tracks **one shared region per server**, set at runtime through
 * `PUT /v1/config/region` rather than fixed in its deployment. So it can drift,
 * and it does — we found it pointed at London, which showed an empty aircraft
 * layer over an island the dashboard exists to watch. The app therefore asserts
 * its subject on startup instead of trusting what it finds (`ensureFlightRegion`).
 *
 * The centre is the island's published position from the API guide, **not**
 * `VIEW_PRESETS.itr`. That preset sits a little north to frame Chandipur in the
 * same shot; using it here would offset every `dist_km` and `bearing` the backend
 * computes from the target.
 *
 * 500 km is the API's own default. Past roughly 460 km the upstream providers fall
 * back to tiled sweeps — more requests per cycle, slightly slower — which is the
 * documented cost of covering the whole downrange fan rather than just the range.
 */
export const FLIGHT_REGION = {
  name: 'Abdul Kalam Island',
  lat: 20.746,
  lon: 87.079,
  radiusKm: 500,
} as const

export interface ViewPreset {
  key: string
  label: string
  lat: number
  lng: number
  zoom: number
  /**
   * Whether a feed is actually connected for this region.
   *
   * Exactly one is live today: the ITR target the Sentiry endpoints watch. The rest
   * are regions this dashboard *could* watch and currently does not — flying to one
   * shows a correct map with no features on it, and saying so up front is better
   * than letting an empty map read as a broken one.
   *
   * They stay clickable regardless. Looking at a region with no feed is a
   * legitimate thing to do; being misled about whether it is monitored is not.
   */
  live?: boolean
}

/**
 * Regions the dashboard can be pointed at.
 *
 * **Every entry is a place, and nothing else.** Two things have been pulled out of
 * this list because they were not places and reading them as destinations was
 * confusing:
 *
 * - the projection and the whole-world camera, which are *how* the map is drawn and
 *   now live in `DisplayPanel`;
 * - a pitched 3D camera on the pad, which was a second view of the region directly
 *   above it rather than a region of its own.
 *
 * Regions rather than countries: an analyst jumps to an area of interest and then
 * narrows by hand.
 */
export const VIEW_PRESETS: ViewPreset[] = [
  // The one region with feeds behind it. Zoom 9 frames the island and the
  // Chandipur complex together without losing the pad box.
  { key: 'itr', label: 'Abdul Kalam I.', lat: 20.9, lng: 87.04, zoom: 9, live: true },
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

/**
 * Places that actually have open cameras.
 *
 * Not a duplicate of `VIEW_PRESETS`, and not merged into it: those are regions an
 * analyst jumps to for the *subject*, and none of them has camera coverage. These
 * exist for one reason — **the dashboard's own target has no open cameras**, and
 * without a way in, switching the layer on near Abdul Kalam Island shows an empty
 * map and reads as a broken feature rather than as an honest absence.
 *
 * Two, matching the two camera regions in `api/_lib/registry.ts`. Each names what you
 * get there, because that is the actual difference between them: London is the dense
 * snapshot network, the Balkans is the inline video. Keep this list in step with that
 * one — a jump target with no source behind it lands on an empty map.
 */
export interface CameraPlace {
  key: string
  label: string
  /** What kind of feed you land on. Shown beside the label. */
  detail: string
  lat: number
  lng: number
  zoom: number
}

export const CAMERA_PLACES: CameraPlace[] = [
  { key: 'london', label: 'London', detail: '~900 stills', lat: 51.51, lng: -0.13, zoom: 12 },
  { key: 'balkans', label: 'Balkan borders', detail: 'live video', lat: 42.15, lng: 22.54, zoom: 9 },
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
 * Step for the +/- buttons and the keyboard.
 *
 * Wheel and pinch zoom are continuous in a GL map, with no snapping to whole
 * levels and nothing to configure — a quarter-level `zoomSnap` used to be needed
 * to get that feel out of Leaflet, and is gone. The buttons still move by half a
 * level rather than a whole one, which MapLibre's built-in control cannot do; see
 * `MapProvider`, which eases by this instead of calling `zoomIn`/`zoomOut`.
 */
export const ZOOM_DELTA = 0.5
