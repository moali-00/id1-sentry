import { useEffect } from 'react'
import L, { type Map as LeafletMap } from 'leaflet'

/**
 * Latitude/longitude grid.
 *
 * A reference frame for judging distance and bearing by eye when the basemap is
 * mostly ocean — which, on a monitoring map, it often is.
 */

/** Grid spacing in degrees. Coarse enough to stay readable at world zoom. */
const INTERVAL = 30

/** The equator and prime meridian are drawn heavier than the rest. */
const AXIS_WEIGHT = 1.1
const LINE_WEIGHT = 0.6

export function useGraticuleLayer(map: LeafletMap | null, visible: boolean): void {
  useEffect(() => {
    if (!map || !visible) return

    const lines: L.Polyline[] = []
    const style = (isAxis: boolean) => ({
      interactive: false,
      color: '#94a3b8',
      weight: isAxis ? AXIS_WEIGHT : LINE_WEIGHT,
      opacity: isAxis ? 0.5 : 0.3,
    })

    for (let lat = -90 + INTERVAL; lat <= 90 - INTERVAL; lat += INTERVAL) {
      lines.push(
        L.polyline(
          [
            [lat, -180],
            [lat, 180],
          ],
          style(lat === 0),
        ),
      )
    }

    for (let lng = -180; lng <= 180; lng += INTERVAL) {
      lines.push(
        L.polyline(
          [
            [-85, lng],
            [85, lng],
          ],
          style(lng === 0),
        ),
      )
    }

    const group = L.layerGroup(lines).addTo(map)
    group.eachLayer((layer) => (layer as L.Polyline).bringToBack())

    return () => {
      group.remove()
    }
  }, [map, visible])
}
