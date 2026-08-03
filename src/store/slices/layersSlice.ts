import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { fetchPoints } from '@/api/monitoring'
import { DATA_LAYERS, DEFAULT_LAYER_STATE, SIGNAL_LAYER_IDS, layersInGroup } from '@/utils/layers'
import { DEFAULT_BASEMAP, type BasemapId } from '@/utils/constants'
import type { DataLayerId, LayerGroupKey, MapPoint, SignalLayerId } from '@/types/monitoring'

/**
 * Non-watch map layers: visibility, group expansion, and the points each signal
 * layer plots.
 *
 * Watches live in `monitoringSlice` because they are the operator's own domain
 * objects with their own lifecycle. Everything here is catalogue data, so it
 * gets its own slice rather than being bolted onto that one.
 */

interface LayersState {
  enabled: Record<DataLayerId, boolean>
  expanded: Record<LayerGroupKey, boolean>
  points: Record<SignalLayerId, MapPoint[]>
  /** Signal layers with a fetch in flight — the rail row shows a spinner. */
  loading: Record<SignalLayerId, boolean>
  /** Chosen basemap. Independent of the chrome theme. */
  basemap: BasemapId
}

const emptyPoints = () =>
  Object.fromEntries(SIGNAL_LAYER_IDS.map((id) => [id, [] as MapPoint[]])) as Record<SignalLayerId, MapPoint[]>

const noneLoading = () =>
  Object.fromEntries(SIGNAL_LAYER_IDS.map((id) => [id, false])) as Record<SignalLayerId, boolean>

const initialState: LayersState = {
  enabled: { ...DEFAULT_LAYER_STATE },
  // All three open: a collapsed group hides what the dashboard can do, and the
  // basemap picker in `display` is the first thing an operator reaches for.
  // The ITR groups open because that target is the subject of the dashboard;
  // the generic demo layers and display toggles start collapsed so the rail
  // does not open at full height.
  expanded: { watches: true, signals: false, itr_zones: true, itr_feeds: true, display: false },
  points: emptyPoints(),
  loading: noneLoading(),
  basemap: DEFAULT_BASEMAP,
}

/**
 * Fetch a signal layer's points.
 *
 * Dispatched lazily when a layer is first switched on, so the dashboard never
 * pays for layers the operator has not asked for.
 */
export const loadLayerPoints = createAsyncThunk('layers/loadPoints', (layerId: SignalLayerId, { signal }) =>
  fetchPoints(layerId, { signal }),
)

const layersSlice = createSlice({
  name: 'layers',
  initialState,
  reducers: {
    toggleLayer(state, action: PayloadAction<DataLayerId>) {
      state.enabled[action.payload] = !state.enabled[action.payload]
    },

    /** Switch every layer in a group on or off at once. */
    setGroupEnabled(state, action: PayloadAction<{ groupKey: LayerGroupKey; enabled: boolean }>) {
      const { groupKey, enabled } = action.payload
      for (const layer of layersInGroup(groupKey)) state.enabled[layer.id] = enabled
    },

    toggleGroupExpanded(state, action: PayloadAction<LayerGroupKey>) {
      state.expanded[action.payload] = !state.expanded[action.payload]
    },

    /**
     * Replace the whole visibility set — used when restoring a shared link,
     * where the URL is authoritative and anything it omits must be off.
     */
    setEnabledLayers(state, action: PayloadAction<DataLayerId[]>) {
      const wanted = new Set(action.payload)
      for (const layer of DATA_LAYERS) state.enabled[layer.id] = wanted.has(layer.id)
    },

    setBasemap(state, action: PayloadAction<BasemapId>) {
      state.basemap = action.payload
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(loadLayerPoints.pending, (state, action) => {
        state.loading[action.meta.arg] = true
      })
      .addCase(loadLayerPoints.fulfilled, (state, action) => {
        state.points[action.meta.arg] = action.payload
        state.loading[action.meta.arg] = false
      })
      .addCase(loadLayerPoints.rejected, (state, action) => {
        state.loading[action.meta.arg] = false
        // Leave whatever points are already plotted; a failed refresh should not
        // clear the map.
      })
  },

  selectors: {
    selectLayerEnabled: (state) => state.enabled,
    selectExpandedGroups: (state) => state.expanded,
    selectLayerPoints: (state) => state.points,
    selectLayerLoading: (state) => state.loading,
    selectBasemap: (state) => state.basemap,
  },
})

export const { toggleLayer, setGroupEnabled, toggleGroupExpanded, setEnabledLayers, setBasemap } = layersSlice.actions

export const { selectLayerEnabled, selectExpandedGroups, selectLayerPoints, selectLayerLoading, selectBasemap } =
  layersSlice.selectors

/** Ids of every layer currently switched on, in registry order. */
export const selectActiveLayerIds = createSelector([selectLayerEnabled], (enabled) =>
  DATA_LAYERS.filter((layer) => enabled[layer.id]).map((layer) => layer.id),
)

/** Points from every enabled signal layer, flattened for the map. */
export const selectVisiblePoints = createSelector([selectLayerEnabled, selectLayerPoints], (enabled, points) =>
  SIGNAL_LAYER_IDS.filter((id) => enabled[id]).flatMap((id) => points[id]),
)

export default layersSlice.reducer
