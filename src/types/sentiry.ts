/**
 * The Sentiry API's own shapes.
 *
 * These mirror `/v1/*` responses field-for-field rather than being convenient
 * for the UI — the adapters in `src/api/sentiry.ts` do that translation. Keeping
 * the wire shape honest means the captured fixtures in `src/data/sentiry/` and a
 * live backend are interchangeable, and a contract change shows up here as a
 * type error instead of silently rendering nothing.
 *
 * Only the fields the dashboard reads are declared. Everything is optional where
 * the capture shows a feed can degrade or return null.
 */

export interface LatLon {
  lat: number
  lon: number
}

export interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

export interface GeoPolygon {
  type: 'Polygon'
  /** GeoJSON winding: `[[[lon, lat], …]]`. */
  coordinates: number[][][]
}

/** Every feed-backed endpoint wraps its payload in this envelope. */
export interface FeedEnvelope<T> {
  source: string
  status: 'ok' | 'degraded' | 'error' | 'empty' | 'unconfigured'
  detail: string | null
  fetched_at: string
  latency_ms?: number
  data: T
}

/* ── /v1/aoi ─────────────────────────────────────────────────────────────── */

export type AoiBoxKey = 'pad' | 'range' | 'airspace' | 'downrange'

export interface AoiBox extends Bounds {
  purpose: string
  geojson: GeoPolygon
}

export interface AoiSite {
  name: string
  aliases?: string[]
  facility?: string
  country?: string
  state?: string
  centre: LatLon
}

export interface AoiResponse {
  target: AoiSite
  secondary_site?: AoiSite
  boxes: Record<AoiBoxKey, AoiBox>
  warning_area?: string
}

/* ── /v1/assessment ──────────────────────────────────────────────────────── */

export type AssessmentLevel = 'low' | 'guarded' | 'elevated' | 'high' | 'severe'

export interface AssessmentIndicator {
  key: string
  label: string
  /** 0–1 contribution to the overall score. */
  weight: number
  /** Null when the feed backing it could not be read — see `available`. */
  score: number | null
  available: boolean
  detail: string | null
}

export interface LaunchWindow {
  start: string
  end: string
}

export interface ActiveWindow {
  warning: string
  kind?: string
  relevance?: string
  window: LaunchWindow
  centroid?: LatLon
  distance_to_island_km?: number
  starts_in_hours?: number
}

export interface AssessmentResponse {
  generated_at: string
  score: number
  level: AssessmentLevel
  confidence: number
  narrative: string
  indicators: AssessmentIndicator[]
  /** Known blind spots — shown verbatim; they are as important as the score. */
  gaps: string[]
  active_windows: ActiveWindow[]
  next_window: ActiveWindow | null
}

/* ── /v1/maritime/* ──────────────────────────────────────────────────────── */

/** A directional wedge inferred from a warning's declared positions. */
export interface Corridor {
  near_km: number
  far_km: number
  bearing_deg: number
  bearing_span_deg: number
  vertex_count: number
}

/**
 * A missile system as referenced from somewhere else in the payload.
 *
 * The API returns this same object wherever it points at a system — corridor
 * candidates, evacuation matches, social matches. It is never a bare string,
 * which is worth stating because assuming otherwise crashes the renderer.
 */
export interface MissileRef {
  key: string
  name: string
  category: string
  range_km: { min: number; max: number }
}

/** Systems whose published range is consistent with a corridor's geometry. */
export interface LikelySystems {
  class: string
  label: string
  confidence: 'low' | 'medium' | 'high'
  basis: string
  implied_range_km: { min: number; max: number } | null
  coupled_impact_km: number | null
  consistent_systems: MissileRef[]
}

export interface MaritimeWarning {
  message_id: number
  number: string
  issued_at: string
  kind: string
  relevance: string
  is_launch_indicator: boolean
  matched_phrases: string[]
  positions: LatLon[]
  bounds: Bounds | null
  centroid: LatLon | null
  distance_to_island_km: number | null
  windows: LaunchWindow[]
  indefinite: boolean
  text: string
  indicator_score?: number
  corridor?: Corridor | null
  /**
   * Inferred from geometry alone — a corridor narrows the candidate field, it
   * never identifies a system. Rendered with that caveat intact.
   */
  likely_systems?: LikelySystems | null
  /** Systems named outright in the warning text, if any. */
  named_systems?: MissileRef[]
  /** Set when a named system's range contradicts the declared geometry. */
  name_geometry_mismatch?: boolean
  /** Pre-formatted relative timing, e.g. `window opens in 2.6d`. */
  timing?: string
}

export interface MaritimeWarningsResponse {
  navarea: string
  evaluated_at: string
  total_active_messages: number
  returned: number
  warnings: MaritimeWarning[]
}

export interface LaunchWindowsResponse {
  evaluated_at: string
  horizon_hours: number
  active_windows: ActiveWindow[]
  upcoming_windows: ActiveWindow[]
  indefinite_warnings: ActiveWindow[]
}

/* ── /v1/aircraft/live ───────────────────────────────────────────────────── */

export interface Aircraft {
  icao24: string
  callsign: string | null
  origin_country: string | null
  longitude: number | null
  latitude: number | null
  baro_altitude: number | null
  geo_altitude: number | null
  velocity: number | null
  true_track: number | null
  on_ground: boolean
  last_contact: number
}

export interface AircraftData {
  snapshot_time?: string
  aircraft_count: number
  airborne_count?: number
  aircraft: Aircraft[]
}

/* ── /v1/maps/firms/wfs and /v1/thermal/hotspots ─────────────────────────── */

export interface ThermalDetection {
  latitude: number
  longitude: number
  /** Kelvin. */
  brightness: number
  /** Fire radiative power, MW. */
  frp: number
  acq_date: string
  acq_time: string
  confidence: string
  layer?: string
}

export interface ThermalData {
  region?: string
  detection_count: number
  detections: ThermalDetection[]
}

/* ── /v1/imagery/optical ─────────────────────────────────────────────────── */

export interface ImageryScene {
  scene_id: string
  collection: string
  constellation: string
  acquired_at: string
  resolution_m: number
  cloud_cover: number
  geometry: GeoPolygon
}

export interface ImageryData {
  scene_count: number
  most_recent?: string
  scenes: ImageryScene[]
}

/* ── /v1/social ──────────────────────────────────────────────────────────── */

export interface SocialItem {
  title: string
  url: string
  published_at: string
  summary: string
  author: string | null
  platform: string
  matched_keywords: string[]
  aoi_relevant: boolean
  evacuation_terms: string[]
  forward_looking_terms: string[]
}

export interface SocialData {
  item_count: number
  aoi_relevant_count?: number
  evacuation_count?: number
  items: SocialItem[]
}

/* ── /v1/social/evacuations ──────────────────────────────────────────────── */

/** A civil precursor report. Extends a social item with why it scored. */
export interface EvacuationItem extends SocialItem {
  matched_query?: string
  /** Road closures, fishing bans — logistics language distinct from evacuation. */
  logistics_terms?: string[]
  /** Systems the report names or implies. Objects, not strings. */
  matched_systems?: MissileRef[]
}

export interface EvacuationsResponse {
  evacuation_count: number
  items: EvacuationItem[]
  indicator: AssessmentIndicator
}

/* ── /v1/notams ──────────────────────────────────────────────────────────── */

/**
 * An airspace danger area, from `/v1/notams/danger-areas`.
 *
 * `positions` is the declared boundary — usually a circle rendered as a polygon
 * ring, which `geometry_source` reports (e.g. `circle:35nm`). `geometry_coarse`
 * warns that the shape is approximated rather than published.
 */
export interface DangerArea {
  notam_id: string
  notam_id_domestic?: string
  q_code: string
  scope: string
  affected_fir: string
  effective: string
  expiration: string
  schedule?: string
  lower_limit?: string
  upper_limit?: string
  is_restriction: boolean
  is_danger_area: boolean
  relevance: string
  geometry_source: string
  geometry_coarse: boolean
  positions: LatLon[]
  distance_to_island_km: number | null
  range_relevant: boolean
  starts_in_hours?: number
  indicator_score?: number
  raw?: string
}

export interface DangerAreasResponse {
  fir: string
  horizon_hours: number
  active: DangerArea[]
  upcoming: DangerArea[]
  counts: { active_total: number; upcoming_total: number; fir_scope: number; expired_dropped: number }
}

/**
 * `/v1/notams` no longer returns a flat NOTAM list — it returns the scored
 * indicator plus the two upstream feeds it was built from.
 */
export interface NotamsResponse {
  fir: string
  indicator: AssessmentIndicator
  /** The feed that can actually see en-route danger areas. */
  skylink: FeedEnvelope<unknown>
  aai: FeedEnvelope<unknown>
  /** Why an empty AAI result is not evidence that the range is open. */
  aai_scope_caveat: string
}

/* ── /v1/missiles ────────────────────────────────────────────────────────── */

export interface MissileSystem {
  key: string
  name: string
  family: string
  category: string
  range_km: { min: number; max: number }
  nuclear_capable: boolean
  integration_sites: string[]
  typical_launch_site: string
  aliases: string[]
  note: string
}

export interface MissilesResponse {
  count: number
  systems: MissileSystem[]
  families: string[]
  categories: string[]
  /** Shown verbatim wherever systems are listed — it is a scope statement. */
  disclaimer: string
}

/* ── /v1/maritime/coupled-trials ─────────────────────────────────────────── */

/**
 * Two warnings that together imply one long-range trial: a launch corridor near
 * the island and a separate impact zone far downrange.
 */
export interface CoupledTrial {
  near_warning: { number: string; kind: string; relevance: string; corridor?: Corridor | null }
  far_warning: { number: string; kind: string; centroid: LatLon | null }
  impact_distance_km: number
  bearing_deg: number
}

export interface CoupledTrialsResponse {
  evaluated_at: string
  pair_count: number
  pairs: CoupledTrial[]
  method?: string
}

/* ── /v1/sources ─────────────────────────────────────────────────────────── */

export interface SourceHealth {
  source: string
  /**
   * `empty` is not in the endpoint's own summary counts but does appear on
   * individual rows — FIRMS answers correctly with no detections. It means the
   * feed worked, which is the opposite of `error`.
   */
  status: 'ok' | 'degraded' | 'error' | 'empty' | 'unconfigured'
  detail: string | null
  fetched_at: string | null
  latency_ms: number | null
  configured: boolean
  used_for_assessment: boolean
}

export interface SourcesResponse {
  sources: SourceHealth[]
  summary: { total: number; ok: number; degraded: number; unconfigured: number; error: number }
}

/* ── /v1/social/posts — the Social Links feed ─────────────────────────────── */

/**
 * A post from the per-platform social sweep.
 *
 * Richer than a `SocialItem`: it carries the author, engagement counts and any
 * systems named in the text. There is **no image URL** anywhere in the payload —
 * only `has_media`. A YouTube thumbnail can be derived from the video id, but a
 * Twitter/X one cannot, so cards fall back to a platform glyph.
 */
export interface SocialPost {
  platform: string
  facet: string
  endpoint: string
  query: string
  title: string
  summary: string
  url: string
  id: string
  published: string
  author: { alias: string | null; id: string | null; url: string | null; followers: number | null } | null
  lang: string | null
  engagement: {
    view_count?: number
    like_count?: number
    retweet_count?: number
    reply_count?: number
    quote_count?: number
  } | null
  hashtags: string[]
  /** Whether the post carried media. Not a URL — see the note above. */
  has_media: boolean
  matched_keywords: string[]
  aoi_relevant: boolean
  evacuation_terms: string[]
  forward_looking_terms: string[]
  logistics_terms: string[]
  matched_systems: MissileRef[]
}

/**
 * One probe against one platform endpoint.
 *
 * The sweep is wide and lossy — 25 of 70 calls failed in the capture, mostly
 * Facebook read timeouts. Which platform was *asked* and came back empty is a
 * different fact from which was never reachable, and only this list separates
 * them, so it is carried through rather than reduced to the failure count.
 */
export interface SocialCall {
  endpoint: string
  platform: string
  facet: string
  query: string
  /**
   * `empty` and `error` are not the same finding. `empty` is a successful query
   * that found nothing — a negative observation. `error` is a blind spot. Only
   * the former is evidence.
   */
  status: 'ok' | 'empty' | 'error'
  /** Absent on `error` rows — the call never completed. */
  exec_time?: number | null
  /** Absent on `error` rows. */
  returned?: number
  /** The failure reason. Present only on `error` rows. */
  detail?: string
}

export interface SocialPostsResponse {
  captured_at: string
  period_of_interest: string
  aoi: string
  provider: string
  /** Provider credits burned by the sweep. */
  sealagom_tokens_spent?: number
  feed: Omit<FeedEnvelope<unknown>, 'data'>
  calls: SocialCall[]
  summary: {
    calls_made: number
    calls_failed: number
    items_total: number
    items_aoi_relevant: number
    story_clusters: number
    by_platform: Record<string, number>
    aoi_relevant_by_platform: Record<string, number>
    named_systems: Record<string, number>
    top_keywords?: Record<string, number>
    items_with_evacuation_language?: number
    items_forward_looking?: number
  }
  aoi_relevant_items: SocialPost[]
  all_items: SocialPost[]
}

/**
 * A post whose attached media was recovered.
 *
 * The main sweep kept only a `has_media` flag and threw the URLs away; this is
 * the same posts re-read for their pictures. Joined to `SocialPost` on
 * `post_url` ↔ `url`.
 *
 * The URLs point at the platform's own image host, so they can expire or be
 * deleted by the poster — every card that shows one has to survive it 404ing.
 */
export interface SocialImagePost {
  post_url: string
  platform: string
  author: string | null
  published: string
  query: string
  view_count: number | null
  like_count: number | null
  text: string
  aoi_relevant: boolean
  matched_keywords: string[]
  /** Plain system names here, unlike `SocialPost.matched_systems`. */
  matched_systems: string[]
  image_urls: string[]
  /** Video poster frames. Usable as a still; the video itself is not embedded. */
  video_urls: string[]
  reproduced_in_report: string | null
}

export interface SocialImagesResponse {
  captured_at: string
  aoi: string
  posts: SocialImagePost[]
}

/* ── Connector captures ───────────────────────────────────────────────────── */

/** A settlement named in evacuation reporting, resolved to coordinates. */
export interface EvacuationPlace {
  query: string
  found: boolean
  display_name: string | null
  lat: number | null
  lon: number | null
  distance_to_island_km: number | null
  distance_to_chandipur_itr_km: number | null
}

export interface ContextConnector {
  evacuation_geocoding: {
    status: string
    queried: number
    resolved: number
    within_50km_of_island: number
    places: EvacuationPlace[]
    note: string
  }
}

/** Weather graded against each declared window — a launch go/no-go. */
export interface WindowVerdict {
  start: string
  end: string
  hours_covered: number
  mean_cloud_cover_pct: number
  peak_gust_ms: number
  peak_precipitation_mm: number
  verdict: 'favourable' | 'marginal' | 'unfavourable' | string
  reasons: string[]
  heuristic?: string
}

export interface WeatherConnector {
  status: string
  hours_in_period: number
  window_verdicts: WindowVerdict[]
  summary: { windows_graded: number; favourable: number; marginal_or_worse: number }
  interpretation: string
}

export interface HazardsConnector {
  /** These feeds only ever subtract confidence; neither carries a weight. */
  verdict: string
  role: string
}
