import { createAsyncThunk, createSelector, createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import { fetchFeed, fetchSnapshot, type MonitoringSnapshot } from '@/api/monitoring'
import { SEED_CLUSTERS, SEED_DETAILS, SEED_FEED, SEED_WATCHES } from '@/data/seed'
import { buildWatchFromDraft, type NewWatchEntities } from '@/utils/buildWatch'
import type { CategoryKey, Cluster, FeedItem, Watch, WatchDetail, WatchDraft } from '@/types/monitoring'

/** The two collapsible rails floating over the map. */
export type RailKey = 'watches' | 'activity'

/** Health of the upstream source, surfaced in the status pill. */
export type SourceStatus = 'idle' | 'loading' | 'ready' | 'error'

interface MonitoringState {
  watches: Watch[]
  clusters: Cluster[]
  /** Topic detail keyed by `Watch.id`. */
  details: Record<string, WatchDetail>
  feed: FeedItem[]
  /** Layer visibility keyed by `Watch.id`. */
  enabled: Record<string, boolean>
  hoveredClusterId: string | null
  selectedClusterId: string | null
  rails: Record<RailKey, boolean>
  status: SourceStatus
  /** Message from the last failed fetch, cleared on the next success. */
  error: string | null
  /** Epoch ms of the last successful fetch. */
  lastFetchedAt: number | null
  /**
   * Watches created in this session. They exist only on the client until the
   * backend owns creation, so a refresh must not overwrite them.
   */
  localWatchIds: string[]
}

/**
 * The store opens on the bundled fixture corpus so the map is never blank on
 * first paint, then `loadSnapshot` replaces it — with the same fixtures while
 * no API is configured, or with live data once one is.
 */
const initialState: MonitoringState = {
  watches: SEED_WATCHES,
  clusters: SEED_CLUSTERS,
  details: SEED_DETAILS,
  feed: SEED_FEED,
  enabled: Object.fromEntries(SEED_WATCHES.map((watch) => [watch.id, true])),
  hoveredClusterId: null,
  selectedClusterId: null,
  rails: { watches: true, activity: true },
  status: 'idle',
  error: null,
  lastFetchedAt: null,
  localWatchIds: [],
}

/** Cluster ids belonging to a watch created in this session. */
function localClusterIds(state: MonitoringState): Set<string> {
  const local = new Set(state.localWatchIds)
  return new Set(state.clusters.filter((cluster) => local.has(cluster.watchId)).map((cluster) => cluster.id))
}

/** Replace server-owned entities while preserving session-local ones. */
function applySnapshot(state: MonitoringState, snapshot: MonitoringSnapshot): void {
  const local = new Set(state.localWatchIds)
  const localClusters = localClusterIds(state)

  const keptWatches = state.watches.filter((watch) => local.has(watch.id))
  const keptClusters = state.clusters.filter((cluster) => local.has(cluster.watchId))
  const keptFeed = state.feed.filter((item) => localClusters.has(item.clusterId))

  state.watches = [...snapshot.watches, ...keptWatches]
  state.clusters = [...snapshot.clusters, ...keptClusters]
  state.feed = [...keptFeed, ...snapshot.feed]
  state.details = {
    ...snapshot.details,
    ...Object.fromEntries(Object.entries(state.details).filter(([watchId]) => local.has(watchId))),
  }

  // A watch arriving for the first time defaults to visible; one the operator
  // has already switched off stays off across refreshes.
  for (const watch of state.watches) {
    state.enabled[watch.id] ??= true
  }
}

/**
 * Cold start: fetch every entity the map needs.
 *
 * The signal comes from thunkAPI, so `dispatch(loadSnapshot()).abort()` cancels
 * the in-flight request — which React StrictMode's double-mount relies on.
 */
export const loadSnapshot = createAsyncThunk('monitoring/loadSnapshot', (_: void, { signal }) =>
  fetchSnapshot({ signal }),
)

/** Poll: refresh only the activity feed. */
export const refreshFeed = createAsyncThunk('monitoring/refreshFeed', (_: void, { signal }) => fetchFeed({ signal }))

const monitoringSlice = createSlice({
  name: 'monitoring',
  initialState,
  reducers: {
    toggleWatch(state, action: PayloadAction<string>) {
      state.enabled[action.payload] = !state.enabled[action.payload]
    },

    /** Group-level toggle in the layer rail: every watch on, or every one off. */
    setAllWatchesEnabled(state, action: PayloadAction<boolean>) {
      for (const watch of state.watches) state.enabled[watch.id] = action.payload
    },

    hoverCluster(state, action: PayloadAction<string | null>) {
      state.hoveredClusterId = action.payload
    },

    selectCluster(state, action: PayloadAction<string | null>) {
      state.selectedClusterId = action.payload
    },

    toggleRail(state, action: PayloadAction<RailKey>) {
      state.rails[action.payload] = !state.rails[action.payload]
    },

    editWatch(state, action: PayloadAction<{ id: string; name: string; category: CategoryKey }>) {
      const { id, name, category } = action.payload
      const watch = state.watches.find((candidate) => candidate.id === id)
      if (!watch) return

      watch.name = name
      watch.category = category

      // Clusters carry their own copy of the category so the map can colour a
      // marker without a lookup — keep them in step with the rename.
      for (const cluster of state.clusters) {
        if (cluster.watchId === id) cluster.category = category
      }
      for (const item of state.feed) {
        const cluster = state.clusters.find((candidate) => candidate.id === item.clusterId)
        if (cluster?.watchId === id) {
          item.watchName = name
          item.category = category
        }
      }
    },

    createWatch: {
      reducer(state, action: PayloadAction<NewWatchEntities>) {
        const { watch, cluster, detail, feedItems } = action.payload

        state.watches.push(watch)
        state.enabled[watch.id] = true
        // Client-only until the backend owns creation — see `applySnapshot`.
        state.localWatchIds.push(watch.id)

        if (cluster) {
          state.clusters.push(cluster)
          // Surface the new cluster straight away so the map can fly to it.
          state.selectedClusterId = cluster.id
        }
        if (detail) state.details[watch.id] = detail
        if (feedItems.length > 0) state.feed.unshift(...feedItems)
      },
      // Id generation and the clock are confined to `prepare`, keeping the
      // reducer a pure function of (state, action).
      prepare(draft: WatchDraft) {
        return { payload: buildWatchFromDraft(draft, { id: nanoid(8), now: Date.now() }) }
      },
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(loadSnapshot.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(loadSnapshot.fulfilled, (state, action) => {
        applySnapshot(state, action.payload)
        state.status = 'ready'
        state.error = null
        state.lastFetchedAt = Date.now()
      })
      .addCase(loadSnapshot.rejected, (state, action) => {
        // A cancelled request is not a failure — StrictMode aborts the first one
        // on every dev mount.
        if (action.meta.aborted) return
        // Keep whatever is already on the map — an unreachable source should
        // degrade to stale data, never to a blank screen.
        state.status = 'error'
        state.error = action.error.message ?? 'Could not reach the monitoring API'
      })
      .addCase(refreshFeed.fulfilled, (state, action) => {
        const localClusters = localClusterIds(state)
        state.feed = [...state.feed.filter((item) => localClusters.has(item.clusterId)), ...action.payload]
        state.status = 'ready'
        state.error = null
        state.lastFetchedAt = Date.now()
      })
      .addCase(refreshFeed.rejected, (state, action) => {
        if (action.meta.aborted) return
        state.status = 'error'
        state.error = action.error.message ?? 'Could not refresh the activity feed'
      })
  },

  selectors: {
    selectWatches: (state) => state.watches,
    selectClusters: (state) => state.clusters,
    selectFeed: (state) => state.feed,
    selectEnabled: (state) => state.enabled,
    selectHoveredClusterId: (state) => state.hoveredClusterId,
    selectSelectedClusterId: (state) => state.selectedClusterId,
    selectRails: (state) => state.rails,
    selectStatus: (state) => state.status,
    selectError: (state) => state.error,
    selectLastFetchedAt: (state) => state.lastFetchedAt,
    selectWatchById: (state, watchId: string | null | undefined) =>
      watchId ? (state.watches.find((watch) => watch.id === watchId) ?? null) : null,
    selectDetailByWatchId: (state, watchId: string | null | undefined) =>
      watchId ? (state.details[watchId] ?? null) : null,
    selectClusterById: (state, clusterId: string | null | undefined) =>
      clusterId ? (state.clusters.find((cluster) => cluster.id === clusterId) ?? null) : null,
  },
})

export const { toggleWatch, setAllWatchesEnabled, hoverCluster, selectCluster, toggleRail, editWatch, createWatch } =
  monitoringSlice.actions

export const {
  selectWatches,
  selectClusters,
  selectFeed,
  selectEnabled,
  selectHoveredClusterId,
  selectSelectedClusterId,
  selectRails,
  selectStatus,
  selectError,
  selectLastFetchedAt,
  selectWatchById,
  selectDetailByWatchId,
  selectClusterById,
} = monitoringSlice.selectors

/**
 * Feed rows follow layer visibility: an item shows only while the watch owning
 * its cluster is switched on. Memoised so toggling an unrelated bit of state
 * does not re-filter the list.
 */
export const selectVisibleFeed = createSelector(
  [selectFeed, selectClusters, selectEnabled],
  (feed, clusters, enabled) => {
    const watchIdByCluster = new Map(clusters.map((cluster) => [cluster.id, cluster.watchId]))
    return feed.filter((item) => {
      const watchId = watchIdByCluster.get(item.clusterId)
      // An item whose cluster is unknown has no layer to hide behind — keep it.
      return watchId === undefined ? true : enabled[watchId]
    })
  },
)

/** Clusters whose watch layer is currently on. */
export const selectVisibleClusters = createSelector([selectClusters, selectEnabled], (clusters, enabled) =>
  clusters.filter((cluster) => enabled[cluster.watchId]),
)

export default monitoringSlice.reducer
