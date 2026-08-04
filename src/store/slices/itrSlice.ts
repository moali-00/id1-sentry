import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import {
  fetchAircraft,
  fetchAoi,
  fetchAssessment,
  fetchContext,
  fetchCoupledTrials,
  fetchDangerAreas,
  fetchEvacuations,
  fetchHazards,
  fetchImagery,
  fetchLaunchWindows,
  fetchMaritimeWarnings,
  fetchMissiles,
  fetchNotams,
  fetchSocial,
  fetchSocialImages,
  fetchSocialPosts,
  fetchSources,
  fetchThermal,
  fetchWeather,
} from '@/api/sentiry'
import {
  aircraftPoints,
  aircraftProjections,
  aoiZones,
  corridorAreas,
  coupledLines,
  dangerAreaAreas,
  evacuationPoints,
  imageryAreas,
  sitePoints,
  socialFeedItems,
  socialImageIndex,
  socialPostFeedItems,
  socialPostPoints,
  socialSites,
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
  EvacuationPlace,
  EvacuationsResponse,
  HazardsConnector,
  ImageryScene,
  LaunchWindowsResponse,
  MaritimeWarning,
  MissilesResponse,
  NotamsResponse,
  SocialImagePost,
  SocialItem,
  SocialPostsResponse,
  SourceHealth,
  ThermalDetection,
  WeatherConnector,
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
  /** The richer per-platform sweep. Kept alongside `social`, not replacing it. */
  socialPosts: SocialPostsResponse | null
  /** Media recovered for the posts that carried pictures, joined on post URL. */
  socialImages: SocialImagePost[]
  /** Settlements from evacuation reporting, resolved to coordinates. */
  evacuationPlaces: EvacuationPlace[]
  weather: WeatherConnector | null
  hazards: HazardsConnector | null
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
  socialPosts: null,
  socialImages: [],
  evacuationPlaces: [],
  weather: null,
  hazards: null,
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
const FEED_COUNT = 19

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
    socialPosts,
    socialImages,
    context,
    weather,
    hazards,
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
    fetchSocialPosts(options),
    fetchSocialImages(options),
    fetchContext(options),
    fetchWeather(options),
    fetchHazards(options),
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
    socialPosts: take(socialPosts, 'social posts'),
    socialImages: take(socialImages, 'social media')?.posts ?? [],
    evacuationPlaces: take(context, 'evacuation geocoding')?.evacuation_geocoding.places ?? [],
    weather: take(weather, 'weather'),
    hazards: take(hazards, 'hazards'),
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
    selectSocialPosts: (state) => state.socialPosts,
    selectSocialImages: (state) => state.socialImages,
    selectEvacuationPlaces: (state) => state.evacuationPlaces,
    selectWeather: (state) => state.weather,
    selectHazards: (state) => state.hazards,
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
  selectSocialPosts,
  selectSocialImages,
  selectEvacuationPlaces,
  selectWeather,
  selectHazards,
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

/**
 * Source health for every upstream, including the ones `/v1/sources` omits.
 *
 * The social sweep reports its own health inside `/v1/social/posts` and is
 * absent from the sources roll-call, so on the raw list a feed that failed 25 of
 * 70 calls reads as if it were never consulted. It is folded in here rather than
 * in the panel so the counts in the header cover it too.
 */
export const selectAllSources = createSelector([selectSources, selectSocialPosts], (sources, posts): SourceHealth[] => {
  if (!posts || sources.some((source) => source.source === posts.feed.source)) return sources

  // Deliberately not the upstream's own note, which is a list of failed
  // requests. What a reader needs from this row is which platforms are covered.
  const covered = Object.keys(posts.summary.by_platform ?? {})
  const detail = covered.length
    ? `${posts.summary.items_aoi_relevant} posts on this target, from ${covered.join(' and ')}. Other platforms returned nothing.`
    : 'No platform returned anything on this target.'

  return [
    ...sources,
    {
      source: posts.feed.source,
      status: posts.feed.status,
      detail,
      fetched_at: posts.feed.fetched_at,
      latency_ms: posts.feed.latency_ms ?? null,
      configured: true,
      // The sweep informs the picture but feeds no scored indicator.
      used_for_assessment: false,
    },
  ]
})

/** Every ITR feature that plots as a point, across all its layers. */
export const selectItrPoints = createSelector(
  [selectAoi, selectWarnings, selectThermal, selectAircraft, selectEvacuationPlaces, selectSocialPosts],
  (aoi, warnings, thermal, aircraft, places, posts): MapPoint[] => [
    ...(aoi ? sitePoints(aoi) : []),
    ...warningPoints(warnings),
    ...evacuationPoints(places),
    ...(aoi && posts ? socialPostPoints(posts.aoi_relevant_items, socialSites(aoi)) : []),
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
    ...corridorAreas(warnings),
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
export const selectItrFeedItems = createSelector(
  [selectSocial, selectSocialPosts, selectSocialImages, selectAoi],
  (social, posts, images, aoi): FeedItem[] => {
    const swept =
      posts && aoi ? socialPostFeedItems(posts.aoi_relevant_items, socialImageIndex(images), socialSites(aoi)) : []

    // Newest first across both feeds. They cover the same target from different
    // collectors, so interleaving them by time reads as one stream rather than
    // as two lists stapled together.
    return [...socialFeedItems(social), ...swept].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
  },
)

export const { streamStatusChanged } = itrSlice.actions

export default itrSlice.reducer
