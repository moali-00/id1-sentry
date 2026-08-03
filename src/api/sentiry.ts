import { request, type RequestOptions } from '@/api/client'
import { hasApi } from '@/utils/env'
import aoiCapture from '@/data/sentiry/aoi.json'
import assessmentCapture from '@/data/sentiry/assessment.json'
import maritimeWarningsCapture from '@/data/sentiry/maritime_warnings.json'
import launchWindowsCapture from '@/data/sentiry/maritime_launch_windows.json'
import aircraftCapture from '@/data/sentiry/aircraft_live_airspace.json'
import thermalCapture from '@/data/sentiry/maps_firms_wfs_downrange.json'
import imageryCapture from '@/data/sentiry/imagery_optical.json'
import socialCapture from '@/data/sentiry/social.json'
import evacuationsCapture from '@/data/sentiry/social_evacuations.json'
import notamsCapture from '@/data/sentiry/notams.json'
import dangerAreasCapture from '@/data/sentiry/notams_danger_areas.json'
import missilesCapture from '@/data/sentiry/missiles.json'
import coupledTrialsCapture from '@/data/sentiry/maritime_coupled_trials.json'
import sourcesCapture from '@/data/sentiry/sources.json'
import type {
  AircraftData,
  AoiResponse,
  AssessmentResponse,
  CoupledTrialsResponse,
  DangerAreasResponse,
  FeedEnvelope,
  ImageryData,
  LaunchWindowsResponse,
  MaritimeWarningsResponse,
  EvacuationsResponse,
  MissilesResponse,
  NotamsResponse,
  SocialData,
  SourcesResponse,
  ThermalData,
} from '@/types/sentiry'

/**
 * The Sentiry API — `/v1/*`.
 *
 * A single fixed AOI (Abdul Kalam Island / Wheeler Island, DRDO Integrated Test
 * Range) watched through eleven upstream feeds. Unlike the generic monitoring
 * endpoints, the target is not a query the operator writes: it is configured
 * server-side, and the dashboard's job is to render what the feeds say about it.
 *
 * Every function returns a live response once `VITE_API_BASE_URL` is set and the
 * captured fixture in `src/data/sentiry/` otherwise. Those captures are the
 * *verbatim* recorded responses, so the two paths are byte-identical in shape
 * and an adapter written against the fixture works unchanged against the API.
 *
 * Refreshing the demo data is a re-capture and a file copy — no code changes.
 */

/**
 * Captures wrap the payload in envelope metadata (`status_code`, `elapsed_ms`,
 * …). The live API returns only what sits under `response`.
 */
function fixture<T>(capture: { response: unknown }): Promise<T> {
  return Promise.resolve(capture.response as T)
}

export function fetchAoi(options?: RequestOptions): Promise<AoiResponse> {
  if (!hasApi()) return fixture<AoiResponse>(aoiCapture)
  return request<AoiResponse>('/v1/aoi', options)
}

export function fetchAssessment(options?: RequestOptions): Promise<AssessmentResponse> {
  if (!hasApi()) return fixture<AssessmentResponse>(assessmentCapture)
  return request<AssessmentResponse>('/v1/assessment', { ...options, params: { include_feeds: 'true' } })
}

export function fetchMaritimeWarnings(options?: RequestOptions): Promise<MaritimeWarningsResponse> {
  if (!hasApi()) return fixture<MaritimeWarningsResponse>(maritimeWarningsCapture)
  return request<MaritimeWarningsResponse>('/v1/maritime/warnings', options)
}

export function fetchLaunchWindows(options?: RequestOptions): Promise<LaunchWindowsResponse> {
  if (!hasApi()) return fixture<LaunchWindowsResponse>(launchWindowsCapture)
  return request<LaunchWindowsResponse>('/v1/maritime/launch-windows', {
    ...options,
    params: { horizon_hours: 720 },
  })
}

/** ADS-B contacts. `box=airspace` is the vacancy-watch box, not the pad. */
export function fetchAircraft(options?: RequestOptions): Promise<FeedEnvelope<AircraftData>> {
  if (!hasApi()) return fixture<FeedEnvelope<AircraftData>>(aircraftCapture)
  return request<FeedEnvelope<AircraftData>>('/v1/aircraft/live', { ...options, params: { box: 'airspace' } })
}

/**
 * FIRMS thermal detections.
 *
 * Queried over `downrange` because that is the box with detections in the
 * capture — the pad and range boxes are legitimately empty, and a layer that is
 * always empty looks broken.
 */
export function fetchThermal(options?: RequestOptions): Promise<FeedEnvelope<ThermalData>> {
  if (!hasApi()) return fixture<FeedEnvelope<ThermalData>>(thermalCapture)
  return request<FeedEnvelope<ThermalData>>('/v1/maps/firms/wfs', { ...options, params: { box: 'downrange' } })
}

export function fetchImagery(options?: RequestOptions): Promise<FeedEnvelope<ImageryData>> {
  if (!hasApi()) return fixture<FeedEnvelope<ImageryData>>(imageryCapture)
  return request<FeedEnvelope<ImageryData>>('/v1/imagery/optical', { ...options, params: { box: 'pad', limit: 5 } })
}

export function fetchSocial(options?: RequestOptions): Promise<FeedEnvelope<SocialData>> {
  if (!hasApi()) return fixture<FeedEnvelope<SocialData>>(socialCapture)
  return request<FeedEnvelope<SocialData>>('/v1/social', options)
}

/**
 * Civil precursor reports — evacuations, road closures, fishing bans.
 *
 * A separate endpoint from `/v1/social` because it is separately scored: this
 * is the `evacuation_notice` indicator, the highest-scoring one in the capture.
 */
export function fetchEvacuations(options?: RequestOptions): Promise<EvacuationsResponse> {
  if (!hasApi()) return fixture<EvacuationsResponse>(evacuationsCapture)
  return request<EvacuationsResponse>('/v1/social/evacuations', options)
}

export function fetchNotams(options?: RequestOptions): Promise<NotamsResponse> {
  if (!hasApi()) return fixture<NotamsResponse>(notamsCapture)
  return request<NotamsResponse>('/v1/notams', options)
}

/**
 * Airspace danger areas, with geometry.
 *
 * The one NOTAM source that can actually see en-route restrictions over the
 * range — the AAI feed is aerodrome-oriented, so an empty AAI result says
 * nothing about whether ITR airspace is closed.
 */
export function fetchDangerAreas(options?: RequestOptions): Promise<DangerAreasResponse> {
  if (!hasApi()) return fixture<DangerAreasResponse>(dangerAreasCapture)
  return request<DangerAreasResponse>('/v1/notams/danger-areas', { ...options, params: { horizon_hours: 720 } })
}

/** Public missile reference data. Context only — nothing here is monitored. */
export function fetchMissiles(options?: RequestOptions): Promise<MissilesResponse> {
  if (!hasApi()) return fixture<MissilesResponse>(missilesCapture)
  return request<MissilesResponse>('/v1/missiles', options)
}

/**
 * Warning pairs that together imply one long-range trial — a launch corridor
 * near the island plus a separate impact zone far downrange.
 */
export function fetchCoupledTrials(options?: RequestOptions): Promise<CoupledTrialsResponse> {
  if (!hasApi()) return fixture<CoupledTrialsResponse>(coupledTrialsCapture)
  return request<CoupledTrialsResponse>('/v1/maritime/coupled-trials', options)
}

export function fetchSources(options?: RequestOptions): Promise<SourcesResponse> {
  if (!hasApi()) return fixture<SourcesResponse>(sourcesCapture)
  return request<SourcesResponse>('/v1/sources', options)
}
