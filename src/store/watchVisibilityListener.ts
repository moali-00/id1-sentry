import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import {
  createWatch,
  loadSnapshot,
  setAllWatchesEnabled,
  toggleWatch,
  WATCH_VISIBILITY_STORAGE_KEY,
} from '@/store/slices/monitoringSlice'
import type { RootState } from '@/store/store'

/**
 * Persists which watches are switched on, mirroring `themeListener`: the reducer
 * stays a pure function of (state, action) and the storage write is a side effect
 * declared here.
 *
 * Hydration is the slice's own job — `monitoringSlice` reads the key into its
 * `initialState` so the first paint already has the right set on the map, with no
 * flash of watches that were meant to be off.
 */
export const watchVisibilityListener = createListenerMiddleware()

watchVisibilityListener.startListening({
  // Every action that can change the visibility map. `loadSnapshot.fulfilled` is
  // here because a snapshot can introduce or retire watches, and the write below
  // is what prunes the retired ones.
  matcher: isAnyOf(toggleWatch, setAllWatchesEnabled, createWatch, loadSnapshot.fulfilled),

  effect: (_action, api) => {
    const { watches, enabled } = (api.getState() as RootState).monitoring

    // Written from the current watch list rather than from `enabled` directly, so
    // the file cannot grow without bound as fixtures and sessions come and go.
    const visibility = Object.fromEntries(watches.map((watch) => [watch.id, enabled[watch.id] ?? true]))

    try {
      window.localStorage.setItem(WATCH_VISIBILITY_STORAGE_KEY, JSON.stringify(visibility))
    } catch {
      // Storage unavailable (private mode) — the choice still holds for this session.
    }
  },
})
