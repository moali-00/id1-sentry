/**
 * Domain model for the live-monitoring surface.
 *
 * A **watch** is a standing query (keyword, hashtag, account, channel or drawn
 * region). Matching posts are grouped into geolocated **clusters** rendered as
 * map markers, summarised per-watch in a **detail** record, and streamed into
 * the activity **feed**.
 */

/** Threat category. Drives the colour of every swatch, marker and legend row. */
export type CategoryKey = 'political' | 'military' | 'conflict' | 'unrest' | 'infra'

/** What a watch matches on. `region` is drawn on the map; the rest are typed. */
export type WatchType = 'keyword' | 'hashtag' | 'account' | 'channel' | 'region'

export interface Watch {
  id: string
  name: string
  category: CategoryKey
  /** Number of matched items currently attributed to this watch. */
  count: number
}

export interface Cluster {
  id: string
  /** Owning `Watch.id` — toggling that watch shows/hides this marker. */
  watchId: string
  category: CategoryKey
  count: number
  lat: number
  lng: number
  /** Marker diameter in px; scales with `count`. */
  size: number
  /** Recent activity — the marker pulses. */
  fresh?: boolean
  /** Ageing out — the marker draws a thinner border. */
  stale?: boolean
  /** Position derived from account metadata, not a geotag — drawn dashed. */
  inferred?: boolean
}

export interface FeedItem {
  id: string
  /** `Cluster.id` this item belongs to — hovering the row highlights the marker. */
  clusterId: string
  watchName: string
  category: CategoryKey
  platform: string
  /** Pre-formatted relative age, e.g. `3m`. */
  time: string
  /**
   * Unix seconds, for ordering. `time` is already formatted and cannot be
   * sorted; two feeds have to interleave by age to read as one stream.
   */
  timestamp?: number
  text: string
  /** 0–5. See `confidenceLabel`. */
  confidence: number
  /** Post author, where the item came from an identifiable account. */
  author?: string
  /** Preview image. May 404 — it is hotlinked from the platform, not archived. */
  thumbnail?: string
  /** The original post. Opened in a new tab; the row is a pointer, not a copy. */
  url?: string
  /**
   * Where to fly when the row is clicked.
   *
   * Set only when the item names a place. Most posts name a system and no
   * location, and inventing a position for those would be a fabrication.
   */
  focus?: { lat: number; lng: number }
}

export interface Post {
  platform: string
  handle: string
  /** Pre-formatted relative age, e.g. `3m`. */
  time: string
  /** Post body. English — the dashboard carries no other language. */
  text: string
  author?: string
  images?: string[]
  url?: string
}

export interface WatchDetail {
  /** Human-readable place name. */
  location: string
  /** Formatted coordinates, e.g. `49.00°N 24.70°E`. */
  coordinates: string
  /** True when the position came from a geotag rather than inference. */
  observed: boolean
  /** Set when the source posts carried no location at all — surfaced as a warning. */
  locationNote?: string
  posts: Post[]
  /** 0–5. */
  confidence: number
  /** Generated analyst summary bullets. */
  insights: string[]
}

/* ── Data layers ─────────────────────────────────────────────────────────────
 *
 * Watches are one kind of map layer; these are the rest. `signal` layers plot
 * points fetched from the API, `display` layers draw cartographic overlays and
 * carry no data of their own. Both are toggled from the same rail.
 */

/** Rail groups, in render order. `watches` holds the user's own watches. */
export type LayerGroupKey = 'watches' | 'signals' | 'itr_zones' | 'itr_feeds' | 'display'

export type SignalLayerId = 'global_incidents' | 'earthquakes' | 'live_news' | 'maritime'
export type DisplayLayerId = 'day_night' | 'graticule'

/** The four AOI boxes from `/v1/aoi`, drawn as polygons. */
export type AoiZoneId = 'aoi_pad' | 'aoi_range' | 'aoi_airspace' | 'aoi_downrange'

/** Feeds watching the ITR target, each plotting its own geometry. */
export type ItrFeedId =
  | 'itr_sites'
  | 'itr_warnings'
  | 'itr_corridors'
  | 'itr_routine'
  | 'itr_impact'
  | 'itr_danger_areas'
  | 'itr_evacuations'
  | 'itr_social'
  | 'itr_thermal'
  | 'itr_aircraft'
  | 'itr_imagery'

export type DataLayerId = SignalLayerId | DisplayLayerId | AoiZoneId | ItrFeedId

export interface DataLayer {
  id: DataLayerId
  label: string
  groupKey: Exclude<LayerGroupKey, 'watches'>
  /** Marker/legend hue. Fixed across themes, like `CategoryKey` colours. */
  color: string
  /** One-line description shown as the rail row's tooltip. */
  hint: string
  /**
   * What a feature on this layer depicts, and how far to trust it.
   *
   * Shown on every map tooltip. Written for someone who has never seen the
   * dashboard before: what the shape is, who declared it, and what it does
   * *not* prove. Falls back to `hint` when omitted.
   */
  explain?: string
  /** Whether the layer starts switched on. */
  defaultOn: boolean
}

/** A single plotted feature belonging to a point layer. */
export interface MapPoint {
  id: string
  layerId: SignalLayerId | ItrFeedId
  lat: number
  lng: number
  label: string
  /** Secondary line in the marker tooltip — magnitude, vessel type, headline. */
  detail?: string
  /** 0–5, drives marker radius. Defaults to 2 when the source reports none. */
  severity?: number
  /** Unix seconds. Formatted for display with `relativeTime`. */
  timestamp?: number
  /** Compass bearing of travel. Present only for moving contacts. */
  bearingDeg?: number
  /** Ground speed in m/s — drives the length of the projection leader. */
  speedMs?: number
}

/**
 * A closed area drawn on the map — an AOI box, a declared danger area, or an
 * imagery footprint.
 */
export interface MapArea {
  id: string
  layerId: AoiZoneId | ItrFeedId
  /** `[lat, lng]` pairs — Leaflet's order, not GeoJSON's. */
  ring: [number, number][]
  label: string
  detail?: string
  /** Drawn dashed for a footprint or a forecast area rather than a hard boundary. */
  dashed?: boolean
  /**
   * 0–1 confidence in what the shape asserts. Drives how strongly it is drawn.
   *
   * Routine range activity recedes; a declared launch trial draws at full
   * strength. Without this every warning looked equally important.
   */
  emphasis?: number
}

/**
 * An open path on the map — a trial's reach from launch site to impact zone.
 *
 * Distinct from `MapArea` because it is not closed and encloses nothing; filling
 * it would assert an area the data does not describe.
 */
export interface MapLine {
  id: string
  layerId: ItrFeedId
  /** `[lat, lng]` pairs — Leaflet's order. */
  path: [number, number][]
  label: string
  detail?: string
  dashed?: boolean
}

/** A place resolved from free text — the search bar's result rows. */
export interface GeoResult {
  id: string
  label: string
  /** Country, region or "coordinates" — shown beneath the label. */
  context: string
  lat: number
  lng: number
  /** Zoom to land on. Omitted results use `FOCUS_ZOOM`. */
  zoom?: number
}

/** Form model backing the create/edit watch modal. */
export interface WatchDraft {
  name: string
  type: WatchType
  /** The typed match term. Unused when `type === 'region'`. */
  match: string
  /** Whether a region has been drawn. Only meaningful when `type === 'region'`. */
  hasRegion: boolean
  platforms: string[]
  dateRange: string
}
