import type { StyleSpecification } from 'maplibre-gl'
import { BASEMAPS, type BasemapId } from '@/utils/constants'
import { env } from '@/utils/env'

/**
 * Basemap choice → a MapLibre style.
 *
 * MapLibre takes either a URL to a style document or the document itself. Vector
 * basemaps hand over CARTO's published URL and let MapLibre fetch it; raster
 * basemaps have no style document to fetch, so a minimal one is assembled here
 * around the tile template.
 *
 * This is the single seam where the basemap is decided, which is why the
 * projection and sky settings are layered on here too rather than in the
 * component — a style swap must not silently drop them.
 */

/** Every style keeps this id for its base layer, so overlays can sit above it. */
export const BASE_LAYER_ID = 'basemap'

/** Raster basemaps ride on a source with this id. */
const RASTER_SOURCE_ID = 'basemap-raster'

/**
 * Font endpoint for a style we assemble ourselves.
 *
 * Taken from CARTO's own published styles, which is where every vector basemap
 * here already fetches its labels from — so a raster basemap adds no new host.
 */
const GLYPHS_URL = 'https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf'

/**
 * A one-source, one-layer style wrapping a raster tile template.
 *
 * `attribution` goes on the source rather than the map: MapLibre reads it from
 * there and keeps the control in step with whatever is actually loaded, so
 * switching basemaps cannot leave the wrong credit on screen.
 */
function rasterStyle(url: string, tileSize: number, attribution: string): StyleSpecification {
  return {
    version: 8,
    // A raster basemap has no labels of its own, but a symbol layer added on top
    // of it needs somewhere to fetch a font from, and a style with no `glyphs`
    // fails those outright rather than falling back.
    glyphs: GLYPHS_URL,
    sources: {
      [RASTER_SOURCE_ID]: { type: 'raster', tiles: [url], tileSize, attribution },
    },
    layers: [{ id: BASE_LAYER_ID, type: 'raster', source: RASTER_SOURCE_ID }],
  }
}

/**
 * The style for a basemap, honouring the `VITE_MAP_TILE_URL_*` overrides.
 *
 * An override turns a vector basemap into a raster one — see `env.tileUrls`.
 */
export function basemapStyle(id: BasemapId): string | StyleSpecification {
  const basemap = BASEMAPS[id]

  const override = id === 'light' || id === 'dark' ? env.tileUrls[id] : null
  if (override) return rasterStyle(override, 256, env.tileAttribution)

  if (basemap.source.kind === 'raster') {
    return rasterStyle(basemap.source.url, basemap.source.tileSize, basemap.attribution)
  }

  return basemap.source.styleUrl
}
