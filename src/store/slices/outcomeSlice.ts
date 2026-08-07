import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit'
import { fetchOutcome, fetchOutcomePosts } from '@/api/outcome'
import { closureAreas, reversalRows, tallyCalls } from '@/utils/outcome'
import type { MapArea } from '@/types/monitoring'
import type { OutcomeBundle, SocialPostsAfter } from '@/types/outcome'

/**
 * The after-action review — what happened on 06 August, and how the pre-event
 * dashboard scored against it.
 *
 * Its own slice rather than more fields on `itrSlice`, because it answers a
 * different question with different lifetime rules. `itr` holds a *standing*
 * reading that polls, streams and goes stale; this holds a *record* captured
 * once the morning after, which cannot go stale and is never refetched. Folding
 * the two together would put a frozen scorecard behind a staleness clock and a
 * live-stream reducer that have nothing to say about it.
 *
 * It also loads on demand rather than on mount — see `loadOutcome`.
 */

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

interface OutcomeState {
  bundle: OutcomeBundle | null
  /** The post-event sweep. Loaded separately — see `loadOutcomePosts`. */
  posts: SocialPostsAfter | null
  status: LoadStatus
  postsStatus: LoadStatus
}

const initialState: OutcomeState = { bundle: null, posts: null, status: 'idle', postsStatus: 'idle' }

/**
 * Pull the review bundle in, once.
 *
 * `condition` short-circuits every call after the first: the captures are frozen
 * files, so a second fetch could only ever return the same bytes, and opening
 * the panel twice must not re-download 250 kB or blank the charts on the way
 * back in. Unlike `loadItr` there is no `allSettled` fan-out — these are bundled
 * imports, so either the chunk arrives or the app itself failed to load.
 */
export const loadOutcome = createAsyncThunk<OutcomeBundle, void, { state: { outcome: OutcomeState } }>(
  'outcome/load',
  () => fetchOutcome(),
  {
    condition: (_, { getState }) => {
      const { status } = getState().outcome
      return status === 'idle' || status === 'error'
    },
  },
)

/**
 * Pull the 196 kB post-event sweep in, once, when the review panel asks for it.
 *
 * Split from `loadOutcome` on size alone: the banner and the map layer need the
 * core captures on first paint, and nothing outside the review panel reads these
 * 101 posts. Same one-shot `condition` — the file cannot change.
 */
export const loadOutcomePosts = createAsyncThunk<SocialPostsAfter, void, { state: { outcome: OutcomeState } }>(
  'outcome/loadPosts',
  () => fetchOutcomePosts(),
  {
    condition: (_, { getState }) => {
      const { postsStatus } = getState().outcome
      return postsStatus === 'idle' || postsStatus === 'error'
    },
  },
)

const outcomeSlice = createSlice({
  name: 'outcome',
  initialState,

  reducers: {},

  extraReducers: (builder) => {
    builder
      .addCase(loadOutcome.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(loadOutcome.fulfilled, (state, action) => {
        state.bundle = action.payload
        state.status = 'ready'
      })
      .addCase(loadOutcome.rejected, (state, action) => {
        if (action.meta.aborted) return
        state.status = 'error'
      })
      .addCase(loadOutcomePosts.pending, (state) => {
        state.postsStatus = 'loading'
      })
      .addCase(loadOutcomePosts.fulfilled, (state, action) => {
        state.posts = action.payload
        state.postsStatus = 'ready'
      })
      .addCase(loadOutcomePosts.rejected, (state, action) => {
        if (action.meta.aborted) return
        state.postsStatus = 'error'
      })
  },

  selectors: {
    selectOutcome: (state) => state.bundle,
    selectOutcomeStatus: (state) => state.status,
    selectOutcomePosts: (state) => state.posts,
    selectOutcomePostsStatus: (state) => state.postsStatus,
  },
})

export const { selectOutcome, selectOutcomeStatus, selectOutcomePosts, selectOutcomePostsStatus } =
  outcomeSlice.selectors

/** The scorecard's own calls, with their verdict tokens counted. */
export const selectVerdictTally = createSelector([selectOutcome], (bundle) =>
  bundle ? tallyCalls(bundle.scorecard.data.calls) : null,
)

/** Named-system mentions before and after, as one row per system. */
export const selectReversal = createSelector([selectOutcome], (bundle) => {
  if (!bundle) return []
  const { pre_event, post_event } = bundle.scorecard.data.social_reversal
  return reversalRows(pre_event, post_event)
})

/**
 * The verified airspace closure, as a map area.
 *
 * Empty until the review is loaded, which is the honest state: the layer draws a
 * correction, and before the capture arrives there is no correction to draw.
 */
export const selectClosureAreas = createSelector([selectOutcome], (bundle): MapArea[] =>
  bundle ? closureAreas(bundle.zones.zones) : [],
)

/**
 * The one-line resolution shown on the map, without loading the whole review.
 *
 * Derived from the bundle when it is present so the banner and the panel can
 * never disagree about what happened.
 */
export const selectResolution = createSelector([selectOutcome, selectVerdictTally], (bundle, tally) => {
  if (!bundle || !tally) return null
  const facts = bundle.groundTruth.data.extracted_facts

  return {
    system: facts.system,
    launchDate: facts.launch_date,
    announcedAt: facts.announced_at_utc,
    site: facts.site_as_stated,
    authority: facts.conducting_authority,
    tally,
  }
})

export default outcomeSlice.reducer
