import { createContext, use } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'

export interface MapController {
  /**
   * Null until the map is constructed.
   *
   * Non-null does **not** mean the style has finished loading — anything that
   * needs a loaded style must check `isStyleLoaded()` or wait for `style.load`,
   * as `useTerrain` and `useFeatureHover` do. Camera calls are safe immediately.
   */
  map: MapLibreMap | null
  /** Set by `<MapCanvas />` from its map ref. Owned by `MapProvider`. */
  onReady: (map: MapLibreMap | null) => void
  /**
   * Animate to a coordinate. Falls back to the default focus zoom.
   *
   * Arguments are lat-then-lng because that is how a person reads a coordinate
   * off a report; the conversion to MapLibre's `[lng, lat]` happens inside.
   */
  flyTo: (
    lat: number,
    lng: number,
    options?: { zoom?: number; duration?: number; pitch?: number; bearing?: number },
  ) => void
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
