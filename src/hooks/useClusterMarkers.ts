import { useEffect, useRef } from 'react'
import L, { type Map as LeafletMap, type Marker } from 'leaflet'
import { createClusterIcon } from '@/utils/markerIcon'
import type { Cluster } from '@/types/monitoring'

interface ClusterMarkerOptions {
  map: LeafletMap | null
  clusters: Cluster[]
  /** Layer visibility keyed by `Watch.id`. */
  enabled: Record<string, boolean>
  hoveredClusterId: string | null
  selectedClusterId: string | null
  isLight: boolean
  onHover: (clusterId: string | null) => void
  onSelect: (cluster: Cluster) => void
}

/**
 * Keep Leaflet markers in sync with cluster state.
 *
 * Markers are imperative objects with a lifetime of their own, so they live in a
 * ref keyed by cluster id and are reconciled across three effects: create/destroy,
 * visibility, then appearance. The effects run in declaration order, so a marker
 * always exists by the time the later two look for it.
 */
export function useClusterMarkers({
  map,
  clusters,
  enabled,
  hoveredClusterId,
  selectedClusterId,
  isLight,
  onHover,
  onSelect,
}: ClusterMarkerOptions): void {
  const markersRef = useRef(new Map<string, Marker>())

  // Handlers are read through a ref so a new callback identity never forces
  // markers to be torn down and rebuilt.
  const handlersRef = useRef({ onHover, onSelect })
  useEffect(() => {
    handlersRef.current = { onHover, onSelect }
  }, [onHover, onSelect])

  // ── Create and destroy ──
  useEffect(() => {
    if (!map) return
    const markers = markersRef.current

    const liveIds = new Set(clusters.map((cluster) => cluster.id))
    for (const [id, marker] of markers) {
      if (liveIds.has(id)) continue
      marker.remove()
      markers.delete(id)
    }

    for (const cluster of clusters) {
      if (markers.has(cluster.id)) continue

      const marker = L.marker([cluster.lat, cluster.lng], {
        icon: createClusterIcon(cluster, { active: false, isLight }),
        riseOnHover: true,
      })
      marker.on('mouseover', () => handlersRef.current.onHover(cluster.id))
      marker.on('mouseout', () => handlersRef.current.onHover(null))
      marker.on('click', () => handlersRef.current.onSelect(cluster))
      markers.set(cluster.id, marker)
    }
  }, [map, clusters, isLight])

  // Drop every marker when the map itself is replaced, so a StrictMode remount
  // does not leave orphans bound to a destroyed instance.
  useEffect(() => {
    if (!map) return
    const markers = markersRef.current
    return () => {
      for (const marker of markers.values()) marker.remove()
      markers.clear()
    }
  }, [map])

  // ── Visibility follows the watch layer toggles ──
  useEffect(() => {
    if (!map) return
    for (const cluster of clusters) {
      const marker = markersRef.current.get(cluster.id)
      if (!marker) continue

      const shouldShow = enabled[cluster.watchId] ?? true
      if (shouldShow && !map.hasLayer(marker)) marker.addTo(map)
      else if (!shouldShow && map.hasLayer(marker)) marker.remove()
    }
  }, [map, clusters, enabled])

  // ── Appearance follows hover, selection and theme ──
  useEffect(() => {
    for (const cluster of clusters) {
      const marker = markersRef.current.get(cluster.id)
      if (!marker) continue

      const active = cluster.id === hoveredClusterId || cluster.id === selectedClusterId
      marker.setIcon(createClusterIcon(cluster, { active, isLight }))
    }
  }, [clusters, hoveredClusterId, selectedClusterId, isLight])
}
