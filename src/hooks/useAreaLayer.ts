import { useEffect, useRef } from 'react'
import L, { type Map as LeafletMap, type Polygon } from 'leaflet'
import { dataLayer, layerColor } from '@/utils/layers'
import { buildTooltip } from '@/utils/mapTooltip'
import type { MapArea } from '@/types/monitoring'

/**
 * Draw closed areas — AOI boxes, declared danger areas, imagery footprints.
 *
 * Reconciled by id like the marker hooks, for the same reason: Leaflet layers
 * are imperative objects that must outlive renders. Areas are deliberately
 * near-transparent and non-interactive; they are context for the markers on top
 * of them, and a filled polygon that swallows clicks would make the points
 * underneath unusable.
 *
 * `emphasis` scales stroke and fill. Routine range activity is in force for
 * weeks and would be on the map whether or not a test were coming, so it
 * recedes; a declared launch trial draws at full strength. Without this every
 * warning looked equally important, which is the opposite of the truth.
 */
export function useAreaLayer(map: LeafletMap | null, areas: MapArea[]): void {
  const layersRef = useRef(new Map<string, Polygon>())

  useEffect(() => {
    if (!map) return
    const polygons = layersRef.current

    const liveIds = new Set(areas.map((area) => area.id))
    for (const [id, polygon] of polygons) {
      if (liveIds.has(id)) continue
      polygon.remove()
      polygons.delete(id)
    }

    // Every polygon calls `bringToBack`, so the *last* one added ends up
    // furthest back. Adding strongest-first therefore leaves the faintest
    // shapes at the bottom of the stack.
    const ordered = [...areas].sort((a, b) => (b.emphasis ?? 1) - (a.emphasis ?? 1))

    for (const area of ordered) {
      if (polygons.has(area.id)) continue

      const color = layerColor(area.layerId)
      const emphasis = area.emphasis ?? 1

      const polygon = L.polygon(area.ring, {
        interactive: false,
        color,
        weight: area.dashed ? 1 : 1 + 0.9 * emphasis,
        dashArray: area.dashed ? '5 4' : undefined,
        opacity: 0.25 + 0.65 * emphasis,
        fillColor: color,
        fillOpacity: (area.dashed ? 0.02 : 0.04) + 0.08 * emphasis,
      })

      polygon.bindTooltip(
        buildTooltip(area.layerId, {
          title: area.label,
          detail: area.detail,
          meta: dataLayer(area.layerId)?.label,
        }),
        { sticky: true },
      )

      polygon.addTo(map)
      // Under every marker, and under the cluster markers in particular.
      polygon.bringToBack()
      polygons.set(area.id, polygon)
    }
  }, [map, areas])

  // Drop everything when the map instance itself is replaced.
  useEffect(() => {
    if (!map) return
    const polygons = layersRef.current
    return () => {
      for (const polygon of polygons.values()) polygon.remove()
      polygons.clear()
    }
  }, [map])
}
