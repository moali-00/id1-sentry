import { useEffect, useRef, useState } from 'react'
import L, { type Map as LeafletMap, type Marker } from 'leaflet'
import { createPointIcon } from '@/utils/markerIcon'
import { dataLayer } from '@/utils/layers'
import { buildTooltip } from '@/utils/mapTooltip'
import { relativeTime } from '@/utils/format'
import type { MapPoint } from '@/types/monitoring'

/**
 * Keep signal-layer point markers in sync with state.
 *
 * Follows the same three-effect reconcile as `useClusterMarkers` (create/destroy
 * → appearance → teardown on map replacement) because the same constraints
 * apply: Leaflet markers are imperative objects that must outlive renders, and
 * StrictMode remounts the map underneath them.
 *
 * Unlike cluster markers these carry no click behaviour — they are context, not
 * subjects. Hovering surfaces a tooltip and nothing more.
 */
export function usePointLayer(map: LeafletMap | null, points: MapPoint[]): void {
  const markersRef = useRef(new Map<string, Marker>())
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // ── Create and destroy ──
  useEffect(() => {
    if (!map) return
    const markers = markersRef.current

    const liveIds = new Set(points.map((point) => point.id))
    for (const [id, marker] of markers) {
      if (liveIds.has(id)) continue
      marker.remove()
      markers.delete(id)
    }

    for (const point of points) {
      if (markers.has(point.id)) continue

      const marker = L.marker([point.lat, point.lng], {
        icon: createPointIcon(point, { active: false }),
        // Below cluster markers, which use the default pane and rise on hover.
        zIndexOffset: -500,
        keyboard: false,
      })

      marker.bindTooltip(tooltipHtml(point), { direction: 'top', offset: [0, -6], opacity: 1 })
      marker.on('mouseover', () => setHoveredId(point.id))
      marker.on('mouseout', () => setHoveredId(null))

      marker.addTo(map)
      markers.set(point.id, marker)
    }
  }, [map, points])

  // ── Appearance follows hover ──
  useEffect(() => {
    for (const point of points) {
      markersRef.current.get(point.id)?.setIcon(createPointIcon(point, { active: point.id === hoveredId }))
    }
  }, [points, hoveredId])

  // Drop every marker when the map instance itself is replaced.
  useEffect(() => {
    if (!map) return
    const markers = markersRef.current
    return () => {
      for (const marker of markers.values()) marker.remove()
      markers.clear()
    }
  }, [map])
}

/** Identity, measurements, provenance, then what the feature actually means. */
function tooltipHtml(point: MapPoint): string {
  const layerLabel = dataLayer(point.layerId)?.label ?? point.layerId
  const age = point.timestamp === undefined ? '' : ` · ${relativeTime(point.timestamp)}`

  return buildTooltip(point.layerId, {
    title: point.label,
    detail: point.detail,
    meta: `${layerLabel}${age}`,
  })
}
