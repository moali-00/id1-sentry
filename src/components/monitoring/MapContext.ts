import { createContext, use, type RefObject } from 'react'
import type { Map as LeafletMap } from 'leaflet'

export interface MapController {
  /** Attach to the element the map renders into. Owned by `MapProvider`. */
  containerRef: RefObject<HTMLDivElement | null>
  /** Null until Leaflet has initialised. */
  map: LeafletMap | null
  /** Animate to a coordinate. Falls back to the default focus zoom. */
  flyTo: (lat: number, lng: number, options?: { zoom?: number; duration?: number }) => void
  zoomIn: () => void
  zoomOut: () => void
}

export const MapContext = createContext<MapController | null>(null)

/** Read the map controller. Throws if used outside `<MapProvider>`. */
export function useMapController(): MapController {
  const controller = use(MapContext)
  if (!controller) throw new Error('useMapController must be used inside <MapProvider>')
  return controller
}
