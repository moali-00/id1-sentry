import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit'
import { fetchCameras, type CameraBounds } from '@/api/cctv'
import { countByMode } from '@/utils/cctv'
import type { Camera, CameraRecord } from '@/types/cctv'

/**
 * Open-source camera feeds.
 *
 * Its own slice rather than a branch of `layersSlice`, for one structural reason:
 * every other layer's data is **fetched once and kept**. A signal layer loads its
 * points when first switched on and that is the end of it (`useSignalPoints`), and
 * the ITR feeds arrive as one document per poll.
 *
 * Cameras are the only layer whose contents depend on **where the camera is
 * pointing**. There are tens of thousands of them worldwide and no view needs more
 * than a few hundred, so the registry is re-queried per viewport. That means a
 * request key, a stale-response guard and a mode filter — three concerns that would
 * be bolted onto a slice whose job is per-layer on/off booleans.
 */

interface CamerasState {
  byId: Record<string, Camera>
  status: 'idle' | 'loading' | 'ready' | 'error'
  /**
   * The bbox of the request currently in flight, or the last one to land.
   *
   * Used to drop stale responses. Panning fires several overlapping requests and they
   * do not come back in order — a warm region answers from cache in milliseconds
   * while a cold one is still fetching, so a slow earlier request can land after a
   * fast later one and repaint the map with the wrong area's cameras.
   */
  requestKey: string | null
  /** Per-source counts from the last response — the rail's provenance line. */
  sources: Record<string, number>
  /** Regions whose upstream failed. A blind spot, not an empty result. */
  failed: string[]
  /** How many cameras the server's cap discarded, if any. */
  truncated: number
  /** ISO timestamp of the registry currently held. */
  timestamp: string | null
}

const initialState: CamerasState = {
  byId: {},
  status: 'idle',
  requestKey: null,
  sources: {},
  failed: [],
  truncated: 0,
  timestamp: null,
}

/** Identifies a viewport request, so a stale response can be recognised as one. */
export const boundsKey = ({ west, south, east, north }: CameraBounds): string =>
  [west, south, east, north].map((value) => value.toFixed(3)).join(',')

export const loadCameras = createAsyncThunk('cameras/load', (bounds: CameraBounds, { signal }) =>
  fetchCameras(bounds, { signal }),
)

const camerasSlice = createSlice({
  name: 'cameras',
  initialState,

  // No reducers. Everything here is a consequence of one fetch, and the layer draws
  // every camera it holds — there is no client-side filter to own.
  reducers: {},

  extraReducers: (builder) => {
    builder
      .addCase(loadCameras.pending, (state, action) => {
        state.status = 'loading'
        state.requestKey = boundsKey(action.meta.arg)
      })
      .addCase(loadCameras.fulfilled, (state, action) => {
        // Drop a response the map has already panned away from.
        if (state.requestKey !== boundsKey(action.meta.arg)) return

        const { cameras, sources, failed, timestamp } = action.payload
        state.byId = Object.fromEntries(
          cameras.map((camera: CameraRecord) => [camera.id, { ...camera, layerId: 'cctv' as const }]),
        )
        state.sources = sources
        state.failed = failed
        state.truncated = 'truncated' in action.payload ? Number(action.payload.truncated) || 0 : 0
        state.timestamp = timestamp
        state.status = 'ready'
      })
      .addCase(loadCameras.rejected, (state, action) => {
        // An abort is the map moving on, not a failure — the newer request owns the
        // status now and overwriting it would flash an error on every pan.
        if (action.meta.aborted) return
        state.status = 'error'
        // Cameras already plotted stay. A failed refresh should not blank the map,
        // the same rule `loadLayerPoints` follows.
      })
  },

  selectors: {
    selectCameraStatus: (state) => state.status,
    selectCameraSources: (state) => state.sources,
    selectCameraFailures: (state) => state.failed,
    selectCameraTruncated: (state) => state.truncated,
    selectCameraTimestamp: (state) => state.timestamp,
    selectCamerasById: (state) => state.byId,
  },
})

export const {
  selectCameraStatus,
  selectCameraSources,
  selectCameraFailures,
  selectCameraTruncated,
  selectCameraTimestamp,
  selectCamerasById,
} = camerasSlice.selectors

/** Every camera held — and what the map draws. There is no filter between them. */
export const selectVisibleCameras = createSelector(
  [selectCamerasById],
  (byId): Camera[] => Object.values(byId),
)

/** Counts by delivery mode, for the one line the rail states. */
export const selectCameraCounts = createSelector([selectVisibleCameras], (cameras) => countByMode(cameras))

/** One camera by id, for the detail route. */
export const selectCameraById = (id: string | undefined) =>
  createSelector([selectCamerasById], (byId) => (id ? byId[id] : undefined))

export default camerasSlice.reducer
