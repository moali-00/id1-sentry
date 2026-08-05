import { useEffect, useRef } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { useMapController } from '@/components/monitoring/MapContext'
import { boundsKey, loadCameras } from '@/store/slices/camerasSlice'
import { selectLayerEnabled } from '@/store/slices/layersSlice'
import { useAppDispatch, useAppSelector } from '@/store/store'
import type { CameraBounds } from '@/api/cctv'

/**
 * Keep the camera registry in step with the viewport.
 *
 * The only layer in the app that re-fetches as the camera moves. Everything else is
 * either loaded once when switched on (`useSignalPoints`) or arrives whole on a poll
 * (`useItrData`) — cameras cannot be, because there are tens of thousands worldwide
 * and no view needs more than a few hundred.
 *
 * Four things keep that from turning into a request per frame.
 */

/**
 * Quiet period after the camera stops before a request goes out.
 *
 * Bound to `moveend`, so this is not debouncing a continuous stream of events — it is
 * waiting out the *next* gesture. A pan is usually several `moveend`s in quick
 * succession as the operator adjusts, and firing on each would send three requests to
 * land on one view.
 */
const SETTLE_MS = 500

/**
 * Fetch at every zoom, world view included.
 *
 * This was a threshold of 5, on the reasoning that a world view intersects every
 * region and returns a capped smear of markers that says nothing. That reasoning was
 * wrong twice over.
 *
 * First, **the app opens at zoom 2** (`INITIAL_VIEW`). A gate at 5 meant the one view
 * every operator sees first was the one view where switching the layer on did
 * nothing at all — which reads as a broken feature, not a considered threshold.
 *
 * Second, the world view is not a smear. It returns 400 cameras clustered over London
 * and the Balkans, and that picture is genuinely the useful one: it answers "where
 * does open camera coverage exist" before you have to guess where to look. The cap and
 * the ordering in `buildRegistry` already keep the payload honest, and a warm world
 * request answers in a fraction of a second.
 */
export const CAMERA_MIN_ZOOM = 0

function currentBounds(map: MapLibreMap): CameraBounds {
  const bounds = map.getBounds()
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  }
}

export function useCameraRegistry(): void {
  const { map } = useMapController()
  const dispatch = useAppDispatch()
  const enabled = useAppSelector(selectLayerEnabled).cctv

  /** The last viewport actually requested, so an unchanged view re-fetches nothing. */
  const lastKey = useRef<string | null>(null)

  useEffect(() => {
    if (!map) return

    // Switched off: drop the memo so switching back on re-queries rather than
    // trusting a registry that may be several pans stale.
    if (!enabled) {
      lastKey.current = null
      return
    }

    let timer: number | undefined
    // Tracks the dispatch so the next one can abort it. Without this, panning across
    // several regions leaves a queue of in-flight requests that all resolve and
    // repaint in whatever order they finish.
    let inFlight: { abort: () => void } | null = null

    const request = () => {
      if (map.getZoom() < CAMERA_MIN_ZOOM) return

      const bounds = currentBounds(map)
      const key = boundsKey(bounds)
      if (key === lastKey.current) return
      lastKey.current = key

      inFlight?.abort()
      inFlight = dispatch(loadCameras(bounds))
    }

    const schedule = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(request, SETTLE_MS)
    }

    // Immediately on enable — the operator has just asked for this layer and should
    // not wait out a settle period for a camera that is not moving.
    request()

    map.on('moveend', schedule)
    map.on('zoomend', schedule)

    return () => {
      window.clearTimeout(timer)
      inFlight?.abort()
      map.off('moveend', schedule)
      map.off('zoomend', schedule)
    }
  }, [map, dispatch, enabled])
}
