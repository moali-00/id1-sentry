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
  status: 'ok' | 'degraded' | 'error' | 'unconfigured'
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
