import { destinationPoint, type LngLatTuple } from '@/utils/geodesy'
import type { FlightAircraft } from '@/types/flights'

/**
 * Presentation and dead-reckoning for live ADS-B contacts.
 *
 * Pure functions only — no React, no store, no map. The interpolation below runs
 * once per aircraft per animation frame, so everything here stays allocation-light
 * and branch-first: the cheap rejections come before any trigonometry.
 */

/** Knots to km/h. */
const KT_TO_KMH = 1.852

/** A fix older than this is dimmed rather than presented as current. */
export const STALE_FIX_MS = 30_000

/**
 * How far ahead dead reckoning is allowed to run, ms.
 *
 * Fixes land every ~2s. If the stream stalls, projecting indefinitely would fly a
 * ghost across the map at 500 knots for as long as the tab stays open, which is a
 * confident lie. Past this the aircraft holds its last known position and the
 * staleness treatment takes over.
 */
const MAX_PROJECTION_MS = 20_000

/**
 * Where an aircraft is *now*, given a fix received `elapsedMs` ago.
 *
 * Aircraft report roughly every 2 seconds. Moving markers only when data arrives
 * makes them visibly jump, so positions are dead-reckoned forward along the
 * reported track at the reported ground speed and re-rendered each frame — the
 * same thing FlightRadar24 and tar1090 do.
 *
 * This uses the great-circle `destinationPoint` rather than the flat-earth delta
 * in the API guide. At 500 knots over 2 seconds the two differ by centimetres, so
 * the reason is not accuracy — it is that the flat form divides by
 * `cos(latitude)`, which explodes near the poles, and the correct formula was
 * already in `geodesy.ts`.
 *
 * Returns `[lon, lat]` — GeoJSON order, ready for a source.
 */
export function projectAircraft(ac: FlightAircraft, elapsedMs: number): LngLatTuple {
  const held: LngLatTuple = [ac.lon, ac.lat]

  // On the ground, gs and track are usually null or zero and an aircraft that is
  // taxiing is not worth predicting. Without a speed or a track there is nothing
  // to project along.
  if (ac.on_ground || ac.gs == null || ac.track == null || ac.gs <= 0) return held
  if (elapsedMs <= 0) return held

  const distanceKm = ac.gs * KT_TO_KMH * (Math.min(elapsedMs, MAX_PROJECTION_MS) / 3_600_000)
  return destinationPoint(ac.lat, ac.lon, ac.track, distanceKm)
}

/**
 * Altitude band → colour, from the design palette's accent row.
 *
 * Red low through blue high is the convention every ADS-B display uses, so an
 * operator already reads it without a legend. Grey is "no altitude", which covers
 * both on-ground and a contact transmitting position without altitude — visually
 * the same statement, that there is no vertical information to show.
 */
export function altitudeColor(ac: FlightAircraft): string {
  if (ac.on_ground || ac.alt_baro == null) return '#6a7282' // text-dim
  if (ac.alt_baro < 10_000) return '#ff6467' // red
  if (ac.alt_baro < 25_000) return '#fbbf24' // amber
  if (ac.alt_baro < 35_000) return '#05df72' // green
  return '#51a2ff' // blue
}

/** Stable keys for the icon set the map registers, one per altitude band. */
export const ALTITUDE_BANDS = ['ground', 'low', 'mid', 'high', 'upper'] as const
export type AltitudeBand = (typeof ALTITUDE_BANDS)[number]

/** The band an aircraft falls in — the icon variant to draw it with. */
export function altitudeBand(ac: FlightAircraft): AltitudeBand {
  if (ac.on_ground || ac.alt_baro == null) return 'ground'
  if (ac.alt_baro < 10_000) return 'low'
  if (ac.alt_baro < 25_000) return 'mid'
  if (ac.alt_baro < 35_000) return 'high'
  return 'upper'
}

export const BAND_COLOR: Record<AltitudeBand, string> = {
  ground: '#6a7282',
  low: '#ff6467',
  mid: '#fbbf24',
  high: '#05df72',
  upper: '#51a2ff',
}

/**
 * What to call an aircraft.
 *
 * Callsign, then registration, then the transponder address upper-cased. A
 * contact with no identity at all is real and common — it still has to be
 * labelled with something an operator can read back.
 */
export function aircraftTitle(ac: FlightAircraft): string {
  const callsign = ac.callsign?.trim()
  if (callsign) return callsign
  const registration = ac.registration?.trim() ?? ac.aircraft?.registration?.trim()
  if (registration) return registration
  return ac.hex.toUpperCase()
}

/** Manufacturer and model, falling back through the ICAO type code. */
export function aircraftModel(ac: FlightAircraft): string | null {
  const info = ac.aircraft
  if (!info) return null

  const full = [info.manufacturer, info.type].filter(Boolean).join(' ').trim()
  return full || info.icao_type || null
}

/** `alt_baro` is null rather than 0 on the ground, so that case reads differently. */
export function altitudeLabel(ac: FlightAircraft): string {
  if (ac.on_ground) return 'On ground'
  if (ac.alt_baro == null) return '—'
  return `${ac.alt_baro.toLocaleString()} ft`
}

export function speedLabel(ac: FlightAircraft): string {
  return ac.gs == null ? '—' : `${Math.round(ac.gs)} kt`
}

/** Vertical rate with a direction glyph; level flight says so rather than "0". */
export function verticalRateLabel(ac: FlightAircraft): string {
  const rate = ac.baro_rate
  if (rate == null) return '—'
  // ADS-B reports small non-zero rates constantly in level flight.
  if (Math.abs(rate) < 100) return 'Level'
  return `${rate > 0 ? '▲' : '▼'} ${Math.abs(rate).toLocaleString()} ft/min`
}

/** `IATA → IATA`, or null when the route never resolved. */
export function routeLabel(ac: FlightAircraft): string | null {
  const origin = ac.route?.origin
  const destination = ac.route?.destination
  if (!origin && !destination) return null

  return `${origin?.iata ?? origin?.icao ?? '???'} → ${destination?.iata ?? destination?.icao ?? '???'}`
}

/** True when this fix is old enough that presenting it as current would mislead. */
export function isStale(ac: FlightAircraft, now: number = Date.now()): boolean {
  // `age_ms` is the server's own measure and accounts for its queue, so prefer it;
  // fall back to the clock when it is absent.
  if (ac.age_ms != null) return ac.age_ms > STALE_FIX_MS
  return now - ac.fix_ts > STALE_FIX_MS
}

/** Track for display. Falls back to the nose heading only when there is no track. */
export function headingDegrees(ac: FlightAircraft): number {
  return ac.track ?? ac.true_heading ?? ac.mag_heading ?? 0
}

/**
 * Whether the aircraft's icon should be rotated at all.
 *
 * A stationary contact with no track drawn as a pointing aircraft asserts a
 * direction that was never reported. Those are drawn as a plain dot instead.
 */
export function hasHeading(ac: FlightAircraft): boolean {
  return ac.track != null || ac.true_heading != null || ac.mag_heading != null
}
