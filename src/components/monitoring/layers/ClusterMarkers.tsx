import { Marker } from 'react-map-gl/maplibre'
import { ClusterMarker } from '@/components/monitoring/markers/ClusterMarker'
import { ReportingMarker } from '@/components/monitoring/markers/ReportingMarker'
import {
  CLUSTER_HOVER_Z,
  CLUSTER_Z,
  REPORTING_HEIGHT,
  REPORTING_OFFSET,
  REPORTING_Z,
} from '@/utils/markerGeometry'
import type { Cluster } from '@/types/monitoring'

/**
 * Cluster markers — numbered circles for watches, solid pills for reporting counts.
 *
 * Rendered as two calls rather than one flag on `Cluster`: the two sets have
 * different lifetimes and different destinations, and sharing one component would
 * mean discriminating on the id inside the click handler.
 *
 * Visibility is keyed on `Cluster.watchId`, so toggling a watch in the rail hides
 * its markers without the cluster list itself changing.
 */

interface ClusterMarkersProps {
  clusters: Cluster[]
  /** Layer visibility keyed by `Watch.id`. */
  enabled: Record<string, boolean>
  hoveredClusterId: string | null
  selectedClusterId: string | null
  isLight: boolean
  onHover: (clusterId: string | null) => void
  onSelect: (cluster: Cluster) => void
}

export function ClusterMarkers({
  clusters,
  enabled,
  hoveredClusterId,
  selectedClusterId,
  isLight,
  onHover,
  onSelect,
}: ClusterMarkersProps) {
  return (
    <>
      {clusters
        .filter((cluster) => enabled[cluster.watchId] ?? true)
        .map((cluster) => (
          <Marker
            key={cluster.id}
            longitude={cluster.lng}
            latitude={cluster.lat}
            opacityWhenCovered="0"
            style={{ zIndex: cluster.id === hoveredClusterId ? CLUSTER_HOVER_Z : CLUSTER_Z, cursor: 'pointer' }}
            onClick={() => onSelect(cluster)}
          >
            <div onPointerEnter={() => onHover(cluster.id)} onPointerLeave={() => onHover(null)}>
              <ClusterMarker
                cluster={cluster}
                active={cluster.id === hoveredClusterId || cluster.id === selectedClusterId}
                isLight={isLight}
              />
            </div>
          </Marker>
        ))}
    </>
  )
}


export function ReportingMarkers({
  clusters,
  enabled,
  hoveredClusterId,
  selectedClusterId,
  onHover,
  onSelect,
}: Omit<ClusterMarkersProps, 'isLight'>) {
  return (
    <>
      {clusters
        .filter((cluster) => enabled[cluster.watchId] ?? true)
        .map((cluster) => (
          <Marker
            key={cluster.id}
            longitude={cluster.lng}
            latitude={cluster.lat}
            // Anchored at its lower-left and nudged up and to the right, so the
            // pill draws beside the site marker rather than over it.
            anchor="bottom-left"
            offset={REPORTING_OFFSET}
            opacityWhenCovered="0"
            style={{ zIndex: REPORTING_Z, cursor: 'pointer', height: REPORTING_HEIGHT }}
            onClick={() => onSelect(cluster)}
          >
            <div onPointerEnter={() => onHover(cluster.id)} onPointerLeave={() => onHover(null)}>
              <ReportingMarker
                cluster={cluster}
                active={cluster.id === hoveredClusterId || cluster.id === selectedClusterId}
              />
            </div>
          </Marker>
        ))}
    </>
  )
}
