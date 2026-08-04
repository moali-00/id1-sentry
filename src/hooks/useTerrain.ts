import { useEffect } from 'react'
import { useMapController } from '@/components/monitoring/MapContext'
import { env } from '@/utils/env'
import { TERRAIN_EXAGGERATION, TERRAIN_MAX_ZOOM, TERRAIN_TILE_SIZE } from '@/utils/constants'

/**
 * 3D terrain, and the hillshade that stands in for it on a flat camera.
 *
 * Imperative rather than a `<Source>` child plus the `terrain` prop, for one
 * reason: **switching basemap replaces the whole style**, and a replaced style has
 * no DEM source and no terrain. So this re-applies itself on `style.load`, which
 * is the event that fires after a swap.
 *
 * Everything is removed again when the layer is switched off, rather than left
 * loaded and hidden. The DEM is a second tile pyramid from a third-party bucket,
 * and a layer that is off should not still be fetching.
 */

const DEM_SOURCE_ID = 'terrain-dem'
const HILLSHADE_LAYER_ID = 'terrain-hillshade'

export function useTerrain(enabled: boolean): void {
  const { map } = useMapController()

  useEffect(() => {
    if (!map) return

    const apply = () => {
      if (!map.getSource(DEM_SOURCE_ID)) {
        map.addSource(DEM_SOURCE_ID, {
          type: 'raster-dem',
          tiles: [env.terrainUrl],
          tileSize: TERRAIN_TILE_SIZE,
          maxzoom: TERRAIN_MAX_ZOOM,
          // Not the spec default. Reading terrarium tiles as Mapbox RGB yields
          // elevations that are wrong without ever looking wrong.
          encoding: 'terrarium',
          attribution: 'Elevation &copy; AWS Open Data · Mapzen',
        })
      }

      map.setTerrain({ source: DEM_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION })

      /*
       * Hillshade goes directly beneath the basemap's own labels.
       *
       * That `beforeId` is what keeps it correct in both orderings: the basemap's
       * symbol layers sit below our overlays, so inserting there puts the shading
       * under the labels *and* under every marker and danger area — however the
       * two sets of layers happen to be re-added after a style swap.
       *
       * A style with no symbol layer is the satellite raster, where imagery
       * already carries its own relief and a shade layer would only mud it.
       */
      const firstSymbol = map.getStyle()?.layers?.find((layer) => layer.type === 'symbol')?.id
      if (firstSymbol && !map.getLayer(HILLSHADE_LAYER_ID)) {
        map.addLayer(
          {
            id: HILLSHADE_LAYER_ID,
            type: 'hillshade',
            source: DEM_SOURCE_ID,
            paint: { 'hillshade-exaggeration': 0.35 },
          },
          firstSymbol,
        )
      }
    }

    const remove = () => {
      // Terrain first: a DEM source cannot be removed while terrain still reads it.
      if (map.getTerrain()) map.setTerrain(null)
      if (map.getLayer(HILLSHADE_LAYER_ID)) map.removeLayer(HILLSHADE_LAYER_ID)
      if (map.getSource(DEM_SOURCE_ID)) map.removeSource(DEM_SOURCE_ID)
    }

    if (!enabled) {
      remove()
      return
    }

    // The style may still be loading on a cold mount, and `addSource` throws then.
    if (map.isStyleLoaded()) apply()
    map.on('style.load', apply)

    return () => {
      map.off('style.load', apply)
      remove()
    }
  }, [map, enabled])
}
