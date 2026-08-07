/**
 * The after-action captures — what actually happened, and how the pre-event
 * dashboard scored against it.
 *
 * These are a different kind of artefact from `@/types/sentiry`. Those mirror a
 * live `/v1/*` contract; these mirror a **frozen review capture** taken once,
 * after the 06 August 2026 Agni-4 trial, and they will never be re-fetched. That
 * is why they are typed separately and loaded separately: an assessment is a
 * standing reading that refreshes, a scorecard is a record that does not.
 *
 * As with the Sentiry types, only the fields the review actually renders are
 * declared, and anything the capture shows can be absent is optional.
 */

/** Every capture carries the same provenance header. */
export interface OutcomeReport {
  name: string
  captured_at: string
  phase: string
  event?: string
  period?: string
  aoi?: string
}

/* ── ground_truth ────────────────────────────────────────────────────────── */

export interface OfficialAnnouncement {
  post_url: string
  author: string
  author_name: string
  published: string
  text: string
  view_count?: number
  like_count?: number
  retweet_count?: number
}

/** The facts as the Ministry of Defence stated them — the thing being scored against. */
export interface ExtractedFacts {
  system: string
  classification_by_mod: string
  launch_date: string
  site_as_stated: string
  conducting_authority: string
  outcome: string
  announced_at_utc: string
}

export interface ReferenceProfile {
  source: string
  designation: string
  class_per_csis: string
  range_km: { min: number; max: number }
  payload_kg: number
  warhead: string
  stages: number
  propellant: string
  length_m: number
  diameter_m: number
  launch_weight_kg: number
  guidance: string
  basing: string
  cep_m: string
  first_test: string
  status_per_csis: string
}

export interface GroundTruth extends OutcomeReport {
  sources: string[]
  data: {
    official_announcement: OfficialAnnouncement
    extracted_facts: ExtractedFacts
    reference_profile: ReferenceProfile
    /** Why MoD and CSIS disagree on the class. A definitional gap, not a factual one. */
    classification_note: string
  }
}

/* ── prediction_scorecard ────────────────────────────────────────────────── */

/**
 * How a single pre-event call turned out.
 *
 * The capture writes the verdict as the first word of a prose sentence rather
 * than as an enum, which is deliberate — the sentence after it is the part worth
 * reading. `outcomeVerdict()` in `@/utils/outcome.ts` recovers the leading token
 * for colour and sorting without discarding the prose.
 */
export interface ScorecardCall {
  claim: string
  basis: string
  outcome: string
  /** Present only on the weather call — the hours that refuted the forecast. */
  evidence?: WeatherHour[]
}

export interface WeatherHour {
  time: string
  cloud_cover: number
  wind_gusts_10m: number
  precipitation: number
  visibility: number
}

export interface DeclaredWindow {
  warning: string
  kind: string
  relevance: string
  start: string
  end: string
  corridor_far_km: number
  corridor_bearing_deg: number
  class: string
  distance_to_island_km: number
}

export interface WeatherVerdict {
  start: string
  end: string
  hours_covered: number
  mean_cloud_cover_pct: number
  peak_gust_ms: number
  peak_precipitation_mm: number
  verdict: string
  reasons: string[]
  heuristic: string
  warning: string
}

/** Counts of how often each system was named, keyed by system. */
export type NamedSystems = Record<string, number>

export interface PredictionScorecard extends OutcomeReport {
  data: {
    ground_truth: ExtractedFacts
    calls: ScorecardCall[]
    pre_event: {
      declared_windows_819: DeclaredWindow[]
      geometry_candidates: string[]
      weather_verdicts_6_aug: WeatherVerdict[]
      social_named_systems: NamedSystems
    }
    post_event: { social_named_systems: NamedSystems }
    social_reversal: {
      pre_event: NamedSystems
      post_event: NamedSystems
      reading: string
    }
    headline: string
    /** Indicators withdrawn from scoring, with the reason. Keyed by indicator. */
    not_scored: Record<string, string>
  }
}

/* ── airspace_exclusion_analysis ─────────────────────────────────────────── */

export interface ExclusionNotam {
  id: string
  q_code: string
  fir: string
  centre: { lat: number; lon: number }
  radius_nm: number
  radius_km: number
  vertical: string
  effective: string
  expiration: string
  schedule: string
  airway_effect: string
  published_alternate: string
  centre_km_from_island: number
  note: string
}

/** One side of the inside/outside traffic comparison, with the launch day called out. */
export interface TrafficStats {
  mean: number
  sd: number
  min: number
  max: number
  launch_day: number
  /** Standard deviations from the baseline mean. Near zero means no visible effect. */
  z: number
}

export interface AirspaceExclusion extends OutcomeReport {
  question: string
  notam: ExclusionNotam
  cell_overlay: { aoi_cells: number; cells_inside_ved52: number; cells_outside: number }
  /** Daily aircraft counts keyed by ISO date, split by the closure boundary. */
  daily_traffic: Record<string, { inside: number; outside: number }>
  result: {
    baseline_days: number
    inside: TrafficStats
    outside: TrafficStats
    inside_share_baseline_pct: number
    inside_share_launch_day_pct: number
  }
  power: {
    closure_hours: number
    fraction_of_day: number
    max_detectable_loss_aircraft: number
    baseline_sd_aircraft: number
    effect_in_sd: number
    verdict: string
  }
  finding: {
    hypothesis_supported: boolean
    reasoning: string[]
    important_caveat: string
    consequence_for_the_gnss_question: string
  }
  incidental_finding: {
    timing_mismatch: Record<string, string>
  }
}

/* ── hourly_adsb_verification ────────────────────────────────────────────── */

export interface AdsbVerification extends OutcomeReport {
  status: string
  question: string
  part_1_historical_data_is_unavailable: {
    finding: string
    sources_tested: { source: string; result: string; message?: string; note?: string }[]
    consequence: string
  }
  part_2_geometry_correction: {
    finding: string
    ved52: { centre: { lat: number; lon: number }; radius_km: number; source: string }
    measurements: {
      place: string
      km_from_centre: number
      inside: boolean
      margin_km: number
      reading: string
    }[]
    why_it_matters: string
  }
  part_3_live_sampling_during_an_active_closure: {
    window: string
    sampled: string
    snapshots: number
    distinct_aircraft: number
    airborne: number
    per_snapshot_total: number[]
    per_snapshot_inside_ved52: number[]
    aircraft_inside_ved52: number
    the_one_transit: { callsign: string; hex: string; reading: string }
    interpretation: {
      observed: string
      consistent_with: string
      /** Spelled as the capture spells it. Renaming it here would break the read. */
      but_not_yet_evidence: string
    }
  }
  bottom_line: string
}

/* ── closed_zones_register ───────────────────────────────────────────────── */

/** A published vertex, carrying both the authority's text and the parsed position. */
export interface ZoneVertex {
  as_published?: string
  lat: number
  lon: number
  km_from_island?: number
  bearing_from_island_deg?: number
}

export interface ZoneContainment {
  place: string
  lat: number
  lon: number
  km_from_centre: number
  inside: boolean
  margin_km: number
  note: string
}

/**
 * One closed zone as of the register's `valid_as_of`.
 *
 * The shapes are genuinely heterogeneous — a circle published as a centre and a
 * radius, open polygons closed by a coastline, a lat/lon box, one warning
 * carrying three separate areas — so the geometry fields are all optional and
 * `zoneRing()` in `@/utils/outcome.ts` normalises whichever is present.
 */
export interface ClosedZone {
  zone: string
  type: string
  shape: string
  title?: string
  activity?: string
  class?: string
  windows?: string[]
  cancels?: string
  note?: string
  caveat?: string
  q_code?: string
  fir?: string
  q_line?: string
  centre?: { as_published?: string; lat: number; lon: number; km_from_island: number; bearing_from_island_deg: number }
  radius?: { nm: number; km: number }
  vertical_limits?: { lower: string; upper: string }
  airway_effect?: { airway: string; status: string; published_alternate?: string; sid?: string }
  notams?: { id: string; effective: string; expiration: string; note?: string; schedule?: string }[]
  extent?: { near_km: number; far_km: number; bearing_deg: number; span_deg?: number }
  /** A circle rasterised to 24 published bearings — see the VED-52 caveat. */
  boundary_ring_24pt?: ZoneVertex[]
  vertices?: ZoneVertex[]
  corners?: ZoneVertex[]
  area_A?: ZoneVertex[]
  area_B?: ZoneVertex[]
  containment?: ZoneContainment[]
}

export interface ClosedZonesRegister extends OutcomeReport {
  valid_as_of: string
  reference_point: { name: string; lat: number; lon: number; note: string }
  second_reference: { name: string; lat: number; lon: number; km_from_island: number }
  counts: { airspace_zones: number; maritime_zones: number; total_vertices: number }
  zones: ClosedZone[]
}

/* ── maritime_after ──────────────────────────────────────────────────────── */

export interface MaritimeAfter extends OutcomeReport {
  data: {
    status: string
    detail: string | null
    message_count_now: number
    message_count_at_capture: number
    still_in_force: string[]
    gone_since_capture: string[]
    new_since_capture: string[]
    launch_indicators_now: {
      number: string
      kind: string
      relevance: string
      text: string
      windows?: { start: string; end: string }[]
    }[]
  }
}

/* ── weather_launch_day ──────────────────────────────────────────────────── */

export interface WeatherLaunchDay extends OutcomeReport {
  source: string
  point: { lat: number; lon: number }
  units: Record<string, string>
  note: string
  /** The four hours inside 819/26's declared 1230–1530Z window. */
  declared_window_6_aug: WeatherHour[]
  hourly: WeatherHour[]
}

/* ── environment_after ───────────────────────────────────────────────────── */

export interface EnvironmentAfter extends OutcomeReport {
  data: {
    thermal_pad: { status: string; count: number; day_range: number }
    thermal_range: { status: string; count: number; day_range: number }
    weather_actual: { status: string; hours: WeatherHour[] }
    usgs_quakes: { status: string; data: unknown[] }
    eonet: {
      status: string
      detail: string | null
      data: { events_scanned: number; events_in_aoi: number; interpretation: string }
    }
    aircraft_now: { airborne_counts: Record<string, number> }
    /** Feeds withdrawn from the picture, with the reason. Keyed by feed. */
    omitted: Record<string, string>
  }
}

/* ── press_analysis_defencesecurityasia ──────────────────────────────────── */

/** One specification, as three independent sources characterise it. */
export interface CrossSourceRow {
  field: string
  mod: string
  csis: string
  dsa: string
  agree: boolean
  note?: string
}

export interface PressAnalysis extends OutcomeReport {
  source: { url: string; outlet: string; author: string; published: string; source_class: string }
  test_facts_as_reported: Record<string, string>
  technical_specifications_as_reported: Record<string, string | number>
  cross_source_agreement: { note: string; rows: CrossSourceRow[]; reading: string }
  /** Claims the outlet made that this test did not observe. Kept separate on purpose. */
  editorial_claims_not_test_facts: { claim: string; status: string; note: string }[]
  relevance_to_this_collection: {
    corroborates: string[]
    adds: string[]
    does_not_address: string[]
    note: string
  }
}

/* ── social_posts_after ──────────────────────────────────────────────────── */

export interface OutcomePost {
  platform: string
  title: string
  summary: string
  url: string
  id: string
  published: string
  lang?: string
  has_media?: boolean
  aoi_relevant?: boolean
}

export interface SocialPostsAfter extends OutcomeReport {
  provider: string
  data: {
    summary: {
      items_total: number
      items_aoi_relevant: number
      story_clusters: number
      named_systems: NamedSystems
      /** Posts describing the trial as a success — the corpus agreeing with MoD. */
      items_reporting_success: number
    }
    aoi_relevant_items: OutcomePost[]
  }
}

/**
 * The nine core captures, loaded together.
 *
 * `SocialPostsAfter` is deliberately not a member: at 196 kB it is twice the
 * rest combined and is read only inside the review panel, so it is fetched and
 * stored on its own. See `@/api/outcome.ts`.
 */
export interface OutcomeBundle {
  groundTruth: GroundTruth
  scorecard: PredictionScorecard
  exclusion: AirspaceExclusion
  adsb: AdsbVerification
  zones: ClosedZonesRegister
  maritime: MaritimeAfter
  weather: WeatherLaunchDay
  environment: EnvironmentAfter
  press: PressAnalysis
}
