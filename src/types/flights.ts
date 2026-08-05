/**
 * Sentry Flight API — live ADS-B traffic within 500 km of Abdul Kalam Island.
 *
 * A separate service from the Sentiry monitoring API (see `./sentiry.ts`), with
 * its own host, its own envelope and a WebSocket stream. Kept in its own file for
 * that reason: nothing here shares a shape with anything there.
 *
 * **Nullability is the defining feature of these types, not an afterthought.**
 * Only `hex`, `lat`, `lon`, `dist_km`, `bearing`, `on_ground` and `fix_ts` are
 * guaranteed. Everything else — including the callsign — can be absent, because a
 * transponder can broadcast a position without an identity, and the three
 * enrichment blocks are third-party lookups that resolve for roughly 30–60% of
 * contacts. The optionality is modelled honestly so the compiler forces every
 * consumer to decide what to render when a field is missing.
 */

/** ADS-B emergency states. `'none'` is the normal case, not an absence. */
export type FlightEmergency = 'none' | 'general' | 'lifeguard' | 'minfuel' | 'nordo' | 'unlawful' | 'downed'

/** An airport at either end of a route. */
export interface FlightAirport {
  name: string | null
  iata: string | null
  icao: string | null
  city: string | null
  country: string | null
  country_iso: string | null
  lat: number | null
  lon: number | null
  /** Feet. */
  elevation: number | null
}

export interface FlightAirline {
  name: string | null
  icao: string | null
  iata: string | null
  /** The spoken callsign — "CATHAY" for CPA. */
  radio: string | null
  country: string | null
}

/** Airframe identity, resolved from the registration. */
export interface FlightAircraftInfo {
  /** Full model, e.g. "777 367ER". */
  type: string | null
  /** ICAO type code, e.g. "B77W". */
  icao_type: string | null
  manufacturer: string | null
  operator: string | null
  operator_country: string | null
  registration: string | null
}

/** Scheduled route, resolved from the callsign. Absent for most non-airliners. */
export interface FlightRoute {
  callsign_iata: string | null
  airline: FlightAirline | null
  origin: FlightAirport | null
  destination: FlightAirport | null
}

/**
 * Airframe photograph.
 *
 * `credit` is a licensing obligation, not decoration — planespotters requires the
 * photographer be named wherever the image appears.
 */
export interface FlightPhoto {
  /** ~200px wide. */
  thumbnail: string | null
  /** ~500px wide. */
  large: string | null
  credit: string | null
  /** The original photo page. */
  link: string | null
  source: string | null
}

/**
 * One tracked aircraft.
 *
 * On `track` vs `mag_heading`: `track` is the direction of travel over the
 * ground, `mag_heading` is where the nose points. In a crosswind they differ by
 * several degrees. Map icons and dead-reckoning must use `track` — that is the
 * direction the aircraft is actually going.
 */
export interface FlightAircraft {
  /* ── Identity ── */
  /** ICAO24 transponder address, lowercase. The only stable id — key on this. */
  hex: string
  /** Can change mid-flight, so never use it as an identity. */
  callsign: string | null
  registration: string | null

  /* ── Position ── */
  lat: number
  lon: number
  /** Distance from the island, km. Precomputed server-side. */
  dist_km: number
  /** Bearing from the island, 0–360° true. */
  bearing: number
  /** True means `alt_baro` is `null` rather than 0, and track/gs are usually absent. */
  on_ground: boolean

  /* ── Altitude ── */
  /** Barometric, feet. What ATC uses — display this one. */
  alt_baro: number | null
  /** GPS, feet. Typically 1–3k higher than barometric. */
  alt_geom: number | null
  /** Vertical speed, ft/min. Negative is descending. */
  baro_rate: number | null
  geom_rate: number | null

  /* ── Speed ── */
  /** Ground speed, knots. Use for display and interpolation. */
  gs: number | null
  ias: number | null
  tas: number | null
  mach: number | null

  /* ── Heading ── */
  /** Direction of travel over the ground, 0–360° true. */
  track: number | null
  mag_heading: number | null
  true_heading: number | null

  /* ── Transponder ── */
  squawk: string | null
  emergency: FlightEmergency | null
  /** 1 when the transponder's alert flag is set. */
  alert: number | null
  /** ADS-B size class: A1 light … A5 heavy, B* rotorcraft/glider, C* surface. */
  category: string | null
  nav_modes: string[] | null
  /** Altitude the autopilot is set to — intent, before the aircraft acts on it. */
  nav_altitude_mcp: number | null

  /* ── Weather, measured by the airframe ── */
  wind_dir: number | null
  wind_speed: number | null
  /** Outside air temperature, °C. */
  oat: number | null

  /* ── Signal ── */
  /** "adsb_icao" is direct and trustworthy; "mlat" is triangulated and looser. */
  pos_type: string | null
  rssi: number | null

  /* ── Enrichment, frequently absent ── */
  aircraft: FlightAircraftInfo | null
  route: FlightRoute | null
  photo: FlightPhoto | null

  /* ── Freshness ── */
  /**
   * When the position was actually measured, unix ms.
   *
   * Interpolate from this, not from the envelope's `generated_at`. Two updates
   * sharing a `fix_ts` are the same fix repeated — ignore the second rather than
   * reading it as "not moving".
   */
  fix_ts: number
  /** Fix age when the server sent it, ms. Over ~30s is worth dimming. */
  age_ms: number | null
  /** Fix age at the upstream provider, seconds. Diagnostic. */
  seen_pos: number | null
  src: string | null
}

/** The region the service covers — centre and radius, for drawing the boundary. */
export interface FlightRegion {
  name: string
  lat: number
  lon: number
  radius_km: number
}

/**
 * `GET /v1/config/region` — the region the server is tracking right now.
 *
 * Note this is a *server-wide* setting, not a per-request filter: there is one
 * tracked region shared by every client, and any caller can change it.
 */
export interface FlightRegionConfig extends FlightRegion {
  /** The radius the upstream providers are actually queried with. */
  radius_nm: number
}

/** `PUT /v1/config/region` — the result of repointing it. */
export interface FlightRegionUpdate {
  region: FlightRegion
  radius_nm: number
  /** True when previously-tracked aircraft were dropped rather than left to expire. */
  cleared_state: boolean
}

/** A data source that must be credited. See §9 of the integration guide. */
export interface FlightAttribution {
  name: string
  url: string
}

/** The envelope shared by `/v1/aircraft` and `/v1/emergencies`. */
export interface FlightEnvelope {
  region: FlightRegion
  count: number
  /** When the server built the response, unix ms. */
  generated_at: number
  /** True means every upstream is failing and positions are stale. */
  degraded: boolean
  attribution: FlightAttribution[]
  ac: FlightAircraft[]
}

/** One historical position. */
export interface FlightTrackPoint {
  fix_ts: number
  lat: number
  lon: number
  alt_baro: number | null
  gs: number | null
  track: number | null
}

/** `/v1/aircraft/{hex}/track` — up to 200 points, oldest first. */
export interface FlightTrackResponse {
  hex: string
  count: number
  points: FlightTrackPoint[]
}

/* ── WebSocket stream ─────────────────────────────────────────────────────── */

/**
 * A delta entry.
 *
 * Only `hex` is guaranteed — everything else is present only if it changed. An
 * entry for an unseen `hex` is a new contact and carries a full record, which is
 * why this is a `Partial` rather than a separate shape.
 */
export type FlightDelta = Partial<FlightAircraft> & { hex: string }

/** Full state; replace everything you hold. Sent on connect and after each `sub`. */
export interface FlightSnapshotMessage extends FlightEnvelope {
  op: 'snapshot'
}

/** Changed fields only; patch onto what you hold. */
export interface FlightUpdateMessage {
  op: 'upd'
  ac: FlightDelta[]
  /** Hexes that left the region or stopped transmitting — delete these. */
  removed: string[]
  degraded: boolean
  generated_at: number
}

/** Keepalive, roughly every 10s. Useful for spotting a dead connection. */
export interface FlightPingMessage {
  op: 'ping'
  t: number
}

export type FlightStreamMessage = FlightSnapshotMessage | FlightUpdateMessage | FlightPingMessage

/** What the client sends to scope the stream to a viewport. */
export interface FlightSubscription {
  op: 'sub'
  /** `[west, south, east, north]` in degrees. */
  bbox?: [number, number, number, number]
  max_dist_km?: number
}
