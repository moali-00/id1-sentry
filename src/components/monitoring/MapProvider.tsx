import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import { FOCUS_ZOOM } from '@/utils/constants'
import { MapContext, type MapController } from '@/components/monitoring/MapContext'
import { useLeafletMap, useTileLayer } from '@/hooks/useLeafletMap'

const DEFAULT_FLY_DURATION_S = 0.8

/**
 * Owns the Leaflet instance and exposes it to the chrome.
 *
 * The container element is rendered by `<MapCanvas />`, which attaches
 * `containerRef` — keeping the map's lifecycle here while the DOM node stays
 * where it belongs in the layout.
 */
export function MapProvider({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const map = useLeafletMap(containerRef)
  useTileLayer(map)

  const flyTo = useCallback<MapController['flyTo']>(
    (lat, lng, options) => {
      map?.flyTo([lat, lng], options?.zoom ?? FOCUS_ZOOM, {
        duration: options?.duration ?? DEFAULT_FLY_DURATION_S,
      })
    },
    [map],
  )

  const zoomIn = useCallback(() => map?.zoomIn(), [map])
  const zoomOut = useCallback(() => map?.zoomOut(), [map])

  const value = useMemo<MapController>(
    () => ({ containerRef, map, flyTo, zoomIn, zoomOut }),
    [map, flyTo, zoomIn, zoomOut],
  )

  return <MapContext value={value}>{children}</MapContext>
}
