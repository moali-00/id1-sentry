import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import {
  fetchAircraft,
  fetchAoi,
  fetchAssessment,
  fetchCoupledTrials,
  fetchDangerAreas,
  fetchEvacuations,
  fetchImagery,
  fetchLaunchWindows,
  fetchMaritimeWarnings,
  fetchMissiles,
  fetchNotams,
  fetchSocial,
  fetchSources,
  fetchThermal,
} from '@/api/sentiry'
import {
  aircraftPoints,
  aircraftProjections,
  aoiZones,
  corridorAreas,
  coupledLines,
  dangerAreaAreas,
  imageryAreas,
  sitePoints,
  socialFeedItems,
  thermalPoints,
  warningAreas,
  warningPoints,
} from '@/utils/sentiryAdapters'
import type { FeedItem, MapArea, MapLine, MapPoint } from '@/types/monitoring'
import type {
  Aircraft,
  AoiResponse,
  AssessmentResponse,
  CoupledTrialsResponse,
  DangerArea,
  DangerAreasResponse,
  EvacuationsResponse,
  ImageryScene,
  LaunchWindowsResponse,
  MaritimeWarning,
  MissilesResponse,
  NotamsResponse,
  SocialItem,
  SourceHealth,
  ThermalDetection,
} from '@/types/sentiry'

/**
 * Everything the Sentiry API knows about the ITR target.
 *
 * One slice rather than one per endpoint: the feeds are all views of the same
 * subject, they load together, and the assessment panel needs several of them at
 * once. Each is stored in its adapted-but-still-faithful form so no data is
 * thrown away on the way in — the panels decide what to show.
 */

/** Live-stream connection state, surfaced in the status pill. */
export type StreamStatus = 'off' | 'live' | 'reconnecting'

interface ItrState {
  aoi: AoiResponse | null
  assessment: AssessmentResponse | null
  warnings: MaritimeWarning[]
  windows: LaunchWindowsResponse | null
  aircraft: Aircraft[]
  thermal: ThermalDetection[]
  imagery: ImageryScene[]
  social: SocialItem[]
  evacuations: EvacuationsResponse | null
  notams: NotamsResponse | null
  dangerAreas: DangerAreasResponse | null
  missiles: MissilesResponse | null
  coupled: CoupledTrialsResponse | null
  sources: SourceHealth[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Event-stream connection state. `off` also covers fixture mode. */
  streamStatus: StreamStatus
  /** Feeds that failed, by name — surfaced rather than silently missing. */
  failed: string[]
  lastFetchedAt: number | null
}

const initialState: ItrState = {
  aoi: null,
  assessment: null,
  warnings: [],
  windows: null,
  aircraft: [],
  thermal: [],
  imagery: [],
  social: [],
  evacuations: null,
  notams: null,
  dangerAreas: null,
  missiles: null,
  coupled: null,
  sources: [],
  status: 'idle',
  streamStatus: 'off',
  failed: [],
  lastFetchedAt: null,
}

export interface ItrPayload extends Omit<ItrState, 'status' | 'streamStatus' | 'failed' | 'lastFetchedAt'> {
  failed: string[]
}

/** How many feeds `loadItr` fans out to — all failing means the API is down. */
const FEED_COUNT = 14

/**
 * Load every ITR feed at once.
 *
 * `allSettled`, not `all`: the capture already shows feeds that legitimately
 * degrade or 502 (GDELT news was down when it was taken). One bad upstream must
 * not blank the other ten, so failures are collected and reported instead.
 */
export const loadItr = createAsyncThunk('itr/load', async (_: void, { signal }) => {
  const options = { signal }

  const [
    aoi,
    assessment,
    warnings,
    windows,
    aircraft,
    thermal,
    imagery,
    social,
    evacuations,
    notams,
    dangerAreas,
    missiles,
    coupled,
    sources,
  ] = await Promise.allSettled([
    fetchAoi(options),
    fetchAssessment(options),
    fetchMaritimeWarnings(options),
    fetchLaunchWindows(options),
    fetchAircraft(options),
    fetchThermal(options),
    fetchImagery(options),
    fetchSocial(options),
    fetchEvacuations(options),
    fetchNotams(options),
    fetchDangerAreas(options),
    fetchMissiles(options),
    fetchCoupledTrials(options),
    fetchSources(options),
  ])

  const failed: string[] = []
  const take = <T>(result: PromiseSettledResult<T>, name: string): T | null => {
    if (result.status === 'fulfilled') return result.value
    failed.push(name)
    return null
  }

  return {
    aoi: take(aoi, 'aoi'),
    assessment: take(assessment, 'assessment'),
    warnings: take(warnings, 'maritime warnings')?.warnings ?? [],
    windows: take(windows, 'launch windows'),
    aircraft: take(aircraft, 'aircraft')?.data.aircraft ?? [],
    thermal: take(thermal, 'thermal')?.data.detections ?? [],
    imagery: take(imagery, 'imagery')?.data.scenes ?? [],
    social: take(social, 'social')?.data.items ?? [],
    evacuations: take(evacuations, 'evacuations'),
    notams: take(notams, 'notams'),
    dangerAreas: take(dangerAreas, 'danger areas'),
    missiles: take(missiles, 'missiles'),
    coupled: take(coupled, 'coupled trials'),
    sources: take(sources, 'sources')?.sources ?? [],
    failed,
  } satisfies ItrPayload
})

const itrSlice = createSlice({
  name: 'itr',
  initialState,
  reducers: {
    streamStatusChanged(state, action: PayloadAction<StreamStatus>) {
      state.streamStatus = action.payload
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(loadItr.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(loadItr.fulfilled, (state, action) => {
        Object.assign(state, action.payload)
        state.status = action.payload.failed.length === FEED_COUNT ? 'error' : 'ready'
        state.lastFetchedAt = Date.now()
      })
      .addCase(loadItr.rejected, (state, action) => {
        if (action.meta.aborted) return
        state.status = 'error'
      })
  },

  selectors: {
    selectAoi: (state) => state.aoi,
    selectAssessment: (state) => state.assessment,
    selectWarnings: (state) => state.warnings,
    selectWindows: (state) => state.windows,
    selectSocial: (state) => state.social,
    selectEvacuations: (state) => state.evacuations,
    selectNotams: (state) => state.notams,
    selectDangerAreas: (state) => state.dangerAreas,
    selectMissiles: (state) => state.missiles,
    selectCoupledTrials: (state) => state.coupled,
    selectSources: (state) => state.sources,
    selectItrStatus: (state) => state.status,
    selectStreamStatus: (state) => state.streamStatus,
    selectFailedFeeds: (state) => state.failed,
    selectAircraft: (state) => state.aircraft,
    selectThermal: (state) => state.thermal,
    selectImagery: (state) => state.imagery,
  },
})

export const {
  selectAoi,
  selectAssessment,
  selectWarnings,
  selectWindows,
  selectSocial,
  selectEvacuations,
  selectNotams,
  selectDangerAreas,
  selectMissiles,
  selectCoupledTrials,
  selectSources,
  selectItrStatus,
  selectStreamStatus,
  selectFailedFeeds,
  selectAircraft,
  selectThermal,
  selectImagery,
} = itrSlice.selectors

/** Every ITR feature that plots as a point, across all its layers. */
export const selectItrPoints = createSelector(
  [selectAoi, selectWarnings, selectThermal, selectAircraft],
  (aoi, warnings, thermal, aircraft): MapPoint[] => [
    ...(aoi ? sitePoints(aoi) : []),
    ...warningPoints(warnings),
    ...thermalPoints(thermal),
    ...aircraftPoints(aircraft),
  ],
)

/** Every ITR feature that plots as an area — AOI boxes, danger areas, footprints. */
export const selectItrAreas = createSelector(
  [selectAoi, selectWarnings, selectImagery, selectDangerAreas],
  (aoi, warnings, imagery, danger): MapArea[] => [
    ...(aoi ? aoiZones(aoi) : []),
    ...warningAreas(warnings),
    ...imageryAreas(imagery),
    ...dangerAreaAreas(danger ? [...danger.active, ...danger.upcoming] : ([] as DangerArea[])),
    // Corridors are drawn from the launch site, so they need the AOI centre.
    ...(aoi ? corridorAreas(warnings, aoi.target.centre) : []),
  ],
)

/** Open paths — currently the coupled trials' launch-to-impact arcs. */
export const selectItrLines = createSelector(
  [selectAoi, selectCoupledTrials, selectAircraft],
  (aoi, coupled, aircraft): MapLine[] => [
    ...(aoi && coupled ? coupledLines(coupled.pairs, aoi.target.centre) : []),
    ...aircraftProjections(aircraft),
  ],
)

/**
 * The target as a single watch-shaped summary.
 *
 * The rail lists watches, so the target is presented as one — named, coloured
 * by its assessment level and counted by how many features it is currently
 * plotting. It is derived rather than stored: the underlying feeds are the
 * truth, and a second copy would drift from them.
 */
export const selectTargetSummary = createSelector(
  [selectAoi, selectAssessment, selectItrPoints, selectItrAreas, selectItrStatus],
  (aoi, assessment, points, areas, status) => ({
    name: aoi?.target.name ?? 'Target',
    facility: aoi?.target.facility ?? '',
    level: assessment?.level ?? null,
    score: assessment?.score ?? null,
    /** Everything currently drawn for this target, across every layer. */
    featureCount: points.length + areas.length,
    loading: status === 'loading',
    ready: aoi !== null,
  }),
)

/**
 * Social and news items as activity-feed rows.
 *
 * Memoised on `social` alone — `Date.now()` is read once per recompute rather
 * than per render, which keeps the row list referentially stable.
 */
export const selectItrFeedItems = createSelector([selectSocial], (social): FeedItem[] => socialFeedItems(social))

export const { streamStatusChanged } = itrSlice.actions

export default itrSlice.reducer
