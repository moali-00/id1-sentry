import { useEffect, useRef } from 'react'
import { openFlightStream, type FlightStreamController } from '@/api/flightStream'
import { ensureFlightRegion } from '@/api/flights'
import { applySnapshot, applyUpdate, setStreamStatus } from '@/store/slices/flightsSlice'
import { selectLayerEnabled } from '@/store/slices/layersSlice'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { useMapController } from '@/components/monitoring/MapContext'
import { FLIGHT_REGION } from '@/utils/constants'
import { hasFlightApi } from '@/utils/env'

/**
 * Own the live flight socket, and keep it scoped to what is on screen.
 *
 * Mounted once, by `MonitoringChrome`, alongside `useLivePoll`.
 *
 * Two things make this more than a `useEffect` around a WebSocket:
 *
 * **The socket follows the viewport.** The server takes a bbox and answers with
 * only the traffic inside it, so panning has to re-subscribe. Every `sub` costs a
 * full ~20 KB snapshot, so the resubscribe is debounced until the camera settles
 * — a drag across the region would otherwise fire one per frame.
 *
 * **The socket closes with the layer.** An operator who switches the aircraft
 * layer off should stop paying for the stream, not just stop seeing it.
 */

/** Long enough to outlast a flick-pan, short enough not to feel laggy. */
const RESUBSCRIBE_DEBOUNCE_MS = 400

/**
 * Padding applied to the requested bbox, as a fraction of span.
 *
 * Subscribing to exactly the viewport means aircraft pop into existence at the
 * edge of the screen. A margin keeps them arriving already in flight, and gives a
 * small pan something to show before the resubscribe lands.
 */
const BBOX_PADDING = 0.25

export function useFlightStream(): void {
  const dispatch = useAppDispatch()
  const { map } = useMapController()
  const enabled = useAppSelector(selectLayerEnabled).itr_aircraft

  const controllerRef = useRef<FlightStreamController | null>(null)

  // Open and close with the layer, not with the component.
  useEffect(() => {
    if (!enabled || !hasFlightApi()) return

    const controller = openFlightStream({
      onSnapshot: (message) => dispatch(applySnapshot(message)),
      onUpdate: (message) => dispatch(applyUpdate(message)),
      onStatus: (status) => dispatch(setStreamStatus(status)),
    })
    controllerRef.current = controller

    /*
     * Make the server track the island, not wherever it was last pointed.
     *
     * Deliberately *not* awaited before opening the socket. The region check is a
     * round trip, and blocking on it would leave the viewport effect below with no
     * controller to subscribe through — so the socket connects immediately and this
     * runs alongside it.
     *
     * A correction clears the server's tracked set, which reaches us as a delta
     * emptying the map. Asking for the subscription again turns that into a
     * snapshot of the new region instead of waiting for it to rebuild one aircraft
     * at a time.
     */
    const region = new AbortController()
    void ensureFlightRegion(FLIGHT_REGION, { signal: region.signal }).then((result) => {
      if (result?.corrected && !region.signal.aborted) controllerRef.current?.resubscribe()
    })

    return () => {
      region.abort()
      controller.close()
      controllerRef.current = null
    }
  }, [dispatch, enabled])

  // Follow the camera.
  useEffect(() => {
    if (!map || !enabled || !hasFlightApi()) return

    let timer: number | undefined

    const push = () => {
      const controller = controllerRef.current
      if (!controller) return

      const bounds = map.getBounds()
      const west = bounds.getWest()
      const south = bounds.getSouth()
      const east = bounds.getEast()
      const north = bounds.getNorth()

      const padX = Math.abs(east - west) * BBOX_PADDING
      const padY = Math.abs(north - south) * BBOX_PADDING

      controller.subscribe({
        // Clamped to valid degrees: a zoomed-out globe reports bounds well past
        // ±180/±90, which the server rejects as a malformed bbox (422).
        bbox: [
          Math.max(-180, west - padX),
          Math.max(-90, south - padY),
          Math.min(180, east + padX),
          Math.min(90, north + padY),
        ],
      })
    }

    const schedule = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(push, RESUBSCRIBE_DEBOUNCE_MS)
    }

    // The socket may not be open yet; `subscribe` is replayed on connect, so an
    // early call is recorded rather than lost.
    push()
    map.on('moveend', schedule)
    map.on('zoomend', schedule)

    return () => {
      window.clearTimeout(timer)
      map.off('moveend', schedule)
      map.off('zoomend', schedule)
    }
  }, [map, enabled])
}
