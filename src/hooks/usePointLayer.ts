import { useEffect, useRef, useState } from 'react'
import L, { type Map as LeafletMap, type Marker } from 'leaflet'
import { createPointIcon } from '@/utils/markerIcon'
import { dataLayer, layerPriority } from '@/utils/layers'
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
 *
 * Two things keep dense areas readable. Markers **scale with zoom**, so at world
 * view they are small dots that do not merge into a blob and grow to full size
 * as you close in. And they are **stacked by layer priority**, so the target
 * site and the declared warnings are never hidden behind a thermal detection.
 */

/** Marker scale by zoom. Below `MIN_ZOOM_FOR_FULL` they shrink toward `MIN_SCALE`. */
const MIN_SCALE = 0.55
const MIN_ZOOM_FOR_FULL = 8

function scaleForZoom(zoom: number): number {
  if (zoom >= MIN_ZOOM_FOR_FULL) return 1
  // Linear from MIN_SCALE at z2 to 1 at z8 — gentle enough that a marker never
  // appears to jump between zoom levels.
  const t = Math.max(0, Math.min(1, (zoom - 2) / (MIN_ZOOM_FOR_FULL - 2)))
  return MIN_SCALE + (1 - MIN_SCALE) * t
}
export function usePointLayer(map: LeafletMap | null, points: MapPoint[]): void {
  const markersRef = useRef(new Map<string, Marker>())
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(() => map?.getZoom() ?? 4)

  // ── Track zoom so marker size can follow it ──
  useEffect(() => {
    if (!map) return
    const sync = () => setZoom(map.getZoom())
    sync()
    map.on('zoomend', sync)
    return () => {
      map.off('zoomend', sync)
    }
  }, [map])

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
        // Created at base size; the appearance effect below sets the real scale
        // on the same tick, and owns it from then on. Reading `zoom` here would
        // mean rebuilding every marker on every zoom instead of restyling it.
        icon: createPointIcon(point, { active: false }),
        // Below cluster markers, which use the default pane and rise on hover.
        // Within that, layer priority decides what wins an overlap.
        zIndexOffset: -500 + layerPriority(point.layerId),
        keyboard: false,
      })

      marker.bindTooltip(tooltipHtml(point), { direction: 'top', offset: [0, -6], opacity: 1 })
      marker.on('mouseover', () => setHoveredId(point.id))
      marker.on('mouseout', () => setHoveredId(null))

      marker.addTo(map)
      markers.set(point.id, marker)
    }
  }, [map, points])

  // ── Appearance follows hover and zoom ──
  useEffect(() => {
    const scale = scaleForZoom(zoom)
    for (const point of points) {
      markersRef.current.get(point.id)?.setIcon(createPointIcon(point, { active: point.id === hoveredId, scale }))
    }
  }, [points, hoveredId, zoom])

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
