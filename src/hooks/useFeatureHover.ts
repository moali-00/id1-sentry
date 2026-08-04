import { useEffect, useState } from 'react'
import type { MapMouseEvent } from 'maplibre-gl'
import { useMapController } from '@/components/monitoring/MapContext'
import type { FeatureProps } from '@/utils/geojson'

export interface HoveredFeature {
  props: FeatureProps
  lat: number
  lng: number
}

/**
 * The area or line under the cursor, for the tooltip to render.
 *
 * MapLibre draws vector data into a canvas, so there is no element to attach a
 * hover listener to the way a DOM marker has one. Instead the cursor position is
 * queried against the rendered frame.
 *
 * Two details matter:
 *
 * - **Only layers that currently exist are queried.** A style swap (changing
 *   basemap) tears down and rebuilds every overlay layer, and
 *   `queryRenderedFeatures` throws on an unknown layer id rather than returning
 *   nothing.
 * - **The tooltip is anchored to the cursor, not the feature.** A danger area can
 *   be 3,800 km across; a tooltip pinned to its centroid would appear somewhere
 *   the operator is not looking.
 */
export function useFeatureHover(layerIds: string[]): HoveredFeature | null {
  const { map } = useMapController()
  const [hovered, setHovered] = useState<HoveredFeature | null>(null)

  useEffect(() => {
    if (!map) return

    const handleMove = (event: MapMouseEvent) => {
      const live = layerIds.filter((id) => map.getLayer(id))
      if (live.length === 0) {
        setHovered(null)
        return
      }

      const [feature] = map.queryRenderedFeatures(event.point, { layers: live })
      if (!feature) {
        setHovered(null)
        return
      }

      setHovered({
        props: feature.properties as FeatureProps,
        lat: event.lngLat.lat,
        lng: event.lngLat.lng,
      })
    }

    const clear = () => setHovered(null)

    map.on('mousemove', handleMove)
    map.on('mouseout', clear)
    // A drag would otherwise leave the tooltip frozen mid-pan.
    map.on('dragstart', clear)

    return () => {
      map.off('mousemove', handleMove)
      map.off('mouseout', clear)
      map.off('dragstart', clear)
    }
    // `layerIds` is a module-level constant array at every call site, so this is
    // stable; spreading it into the dep list would re-bind on every render.
  }, [map, layerIds])

  return hovered
}
