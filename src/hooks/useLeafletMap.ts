import { useEffect, useState, type RefObject } from 'react'
import L, { type Map as LeafletMap } from 'leaflet'
import { env } from '@/utils/env'
import { BASEMAPS, INITIAL_VIEW, MAX_ZOOM, MIN_ZOOM, ZOOM_DELTA, ZOOM_SNAP } from '@/utils/constants'
import { selectBasemap } from '@/store/slices/layersSlice'
import { useAppSelector } from '@/store/store'

/** Leaflet needs a beat after mount before it can measure its container. */
const INVALIDATE_DELAY_MS = 120

/** Upstream CARTO tiles are served up to z19; the map itself caps lower. */
const TILE_MAX_ZOOM = 19

/**
 * Create the Leaflet map bound to `containerRef` and return the instance.
 *
 * The instance is returned as state rather than a ref so that dependent effects
 * (tiles, markers) re-run when it is recreated — which React StrictMode does on
 * every mount in development.
 */
export function useLeafletMap(containerRef: RefObject<HTMLDivElement | null>): LeafletMap | null {
  const [map, setMap] = useState<LeafletMap | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const instance = L.map(container, {
      // The rails supply their own zoom buttons, positioned clear of the chrome.
      zoomControl: false,
      worldCopyJump: true,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      attributionControl: true,
      // ── Feel ──
      // Leaflet's defaults snap zoom to whole levels and move a full level per
      // wheel notch, which reads as a series of jumps rather than a camera.
      zoomSnap: ZOOM_SNAP,
      zoomDelta: ZOOM_DELTA,
      wheelPxPerZoomLevel: 100,
      wheelDebounceTime: 20,
    }).setView(INITIAL_VIEW.center, INITIAL_VIEW.zoom)

    setMap(instance)
    const timer = window.setTimeout(() => instance.invalidateSize(), INVALIDATE_DELAY_MS)

    return () => {
      window.clearTimeout(timer)
      instance.remove()
      setMap(null)
    }
  }, [containerRef])

  return map
}

/**
 * Swap the basemap whenever the operator picks a different one.
 *
 * Driven by the chosen basemap rather than the chrome theme: a dark UI over a
 * legible map is a normal thing to want, and tying the two together made the
 * whole surface dark by default.
 */
export function useTileLayer(map: LeafletMap | null): void {
  const basemapId = useAppSelector(selectBasemap)
  const basemap = BASEMAPS[basemapId]

  useEffect(() => {
    if (!map) return

    // The `VITE_MAP_TILE_URL_*` overrides exist for air-gapped deployments and
    // apply to the plain light/dark rasters they were written for.
    const override = basemap.id === 'light' || basemap.id === 'dark' ? env.tileUrls[basemap.id] : null
    const attribution = override ? env.tileAttribution : basemap.attribution

    // `{r}` is resolved here rather than via Leaflet's `detectRetina`, which
    // additionally halves the tile size and shifts the zoom offset — with an
    // `@2x` URL that double-counts and ends up requesting the wrong tiles.
    const wantsRetina = basemap.retina === true && window.devicePixelRatio > 1
    const url = (override ?? basemap.url).replace('{r}', wantsRetina ? '@2x' : '')

    const layer = L.tileLayer(url, {
      subdomains: basemap.subdomains ?? '',
      maxZoom: TILE_MAX_ZOOM,
      attribution,
    })
    layer.addTo(map)
    // Keep tiles beneath the marker pane.
    layer.bringToBack()

    return () => {
      layer.remove()
    }
  }, [map, basemap])
}
