import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { FOCUS_ZOOM, ZOOM_DELTA } from '@/utils/constants'
import { MapContext, type MapController } from '@/components/monitoring/MapContext'

const DEFAULT_FLY_DURATION_S = 0.8

/** Seconds are the unit the callers speak; MapLibre wants milliseconds. */
const SECONDS_TO_MS = 1000

/**
 * Holds the map instance and exposes it to the chrome.
 *
 * The instance itself is created by `<MapCanvas />`, which renders react-map-gl's
 * `<Map>` and hands the loaded map back through `onReady`. That inversion —
 * canvas creates, provider holds — exists because the chrome needs the map and
 * is not a child of the canvas: the search bar flies to a result, the zoom
 * buttons zoom, the coordinate readout tracks the cursor.
 *
 * react-map-gl ships its own `useMap()`, but it only resolves for components
 * *inside* `<Map>`. Keeping our own context means the chrome does not have to
 * move into the map's subtree to reach it.
 */
export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<MapLibreMap | null>(null)

  const flyTo = useCallback<MapController['flyTo']>(
    (lat, lng, options) => {
      map?.flyTo({
        center: [lng, lat],
        zoom: options?.zoom ?? FOCUS_ZOOM,
        duration: (options?.duration ?? DEFAULT_FLY_DURATION_S) * SECONDS_TO_MS,
        // Omitted means "leave the camera as the operator set it". Only a preset
        // that is about the third dimension states a tilt; a fly-to from the
        // search bar or the activity feed should not quietly level the view.
        ...(options?.pitch === undefined ? {} : { pitch: options.pitch }),
        ...(options?.bearing === undefined ? {} : { bearing: options.bearing }),
      })
    },
    [map],
  )

  // MapLibre's own `zoomIn`/`zoomOut` step a whole level. The dashboard has
  // always moved in fractions, so the buttons ease by `ZOOM_DELTA` instead.
  const zoomIn = useCallback(() => map?.easeTo({ zoom: map.getZoom() + ZOOM_DELTA }), [map])
  const zoomOut = useCallback(() => map?.easeTo({ zoom: map.getZoom() - ZOOM_DELTA }), [map])

  const value = useMemo<MapController>(
    () => ({ map, onReady: setMap, flyTo, zoomIn, zoomOut }),
    [map, flyTo, zoomIn, zoomOut],
  )

  return <MapContext value={value}>{children}</MapContext>
}
