import { useEffect, useRef } from 'react'
import L, { type Map as LeafletMap, type Polyline } from 'leaflet'
import { dataLayer, layerColor } from '@/utils/layers'
import { buildTooltip } from '@/utils/mapTooltip'
import type { MapLine } from '@/types/monitoring'

/**
 * Draw open paths — a trial's reach from launch site to impact zone.
 *
 * Reconciled by id like the marker and area hooks. Unlike areas these are drawn
 * *above* the polygons and carry a heavier stroke: an impact arc is a claim
 * about where something is going, and it should read as the strongest line on
 * the map rather than as another boundary.
 */
export function useLineLayer(map: LeafletMap | null, lines: MapLine[]): void {
  const layersRef = useRef(new Map<string, Polyline>())

  useEffect(() => {
    if (!map) return
    const polylines = layersRef.current

    const liveIds = new Set(lines.map((line) => line.id))
    for (const [id, polyline] of polylines) {
      if (liveIds.has(id)) continue
      polyline.remove()
      polylines.delete(id)
    }

    for (const line of lines) {
      if (polylines.has(line.id)) continue

      const color = layerColor(line.layerId)
      const polyline = L.polyline(line.path, {
        interactive: true,
        color,
        weight: 2.5,
        opacity: 0.95,
        dashArray: line.dashed ? '6 5' : undefined,
        lineCap: 'round',
      })

      polyline.bindTooltip(
        buildTooltip(line.layerId, {
          title: line.label,
          detail: line.detail,
          meta: dataLayer(line.layerId)?.label,
        }),
        { sticky: true },
      )
      polyline.addTo(map)
      polylines.set(line.id, polyline)
    }
  }, [map, lines])

  useEffect(() => {
    if (!map) return
    const polylines = layersRef.current
    return () => {
      for (const polyline of polylines.values()) polyline.remove()
      polylines.clear()
    }
  }, [map])
}
