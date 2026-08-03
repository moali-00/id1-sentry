import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMapController } from '@/components/monitoring/MapContext'
import { useClusterMarkers } from '@/hooks/useClusterMarkers'
import { useDayNightLayer } from '@/hooks/useDayNightLayer'
import { useGraticuleLayer } from '@/hooks/useGraticuleLayer'
import { useAreaLayer } from '@/hooks/useAreaLayer'
import { useLineLayer } from '@/hooks/useLineLayer'
import { useItrData } from '@/hooks/useItrData'
import { usePointLayer } from '@/hooks/usePointLayer'
import { useSignalPoints } from '@/hooks/useSignalPoints'
import { selectItrAreas, selectItrLines, selectItrPoints } from '@/store/slices/itrSlice'
import type { Cluster } from '@/types/monitoring'
import { useAppDispatch, useAppSelector } from '@/store/store'
import {
  hoverCluster,
  selectClusters,
  selectCluster,
  selectEnabled,
  selectHoveredClusterId,
  selectSelectedClusterId,
} from '@/store/slices/monitoringSlice'
import { selectBasemap, selectLayerEnabled, selectVisiblePoints } from '@/store/slices/layersSlice'
import { BASEMAPS } from '@/utils/constants'
import { WATCHES_ENABLED } from '@/utils/layers'

/** Stable empty array — a fresh `[]` each render would re-run the marker sync. */
const NO_CLUSTERS: Cluster[] = []

/**
 * The map itself — the product surface every other panel floats above.
 *
 * Renders nothing but the container Leaflet draws into; all marker syncing is
 * delegated to `useClusterMarkers`.
 */
export function MapCanvas() {
  const { containerRef, map } = useMapController()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  // Demo watch clusters are fixture data. They stay off the map entirely while
  // watches are disabled — the rail hiding them was not enough, since the
  // markers are driven straight from the slice.
  const seedClusters = useAppSelector(selectClusters)
  const clusters = WATCHES_ENABLED ? seedClusters : NO_CLUSTERS
  const enabled = useAppSelector(selectEnabled)
  const hoveredClusterId = useAppSelector(selectHoveredClusterId)
  const selectedClusterId = useAppSelector(selectSelectedClusterId)
  // Marker contrast follows the basemap, not the chrome theme — the markers are
  // drawn on the tiles, not on the panels.
  const isLight = BASEMAPS[useAppSelector(selectBasemap)].isLight
  const points = useAppSelector(selectVisiblePoints)
  const layerEnabled = useAppSelector(selectLayerEnabled)
  const itrPoints = useAppSelector(selectItrPoints)
  const itrAreas = useAppSelector(selectItrAreas)
  const itrLines = useAppSelector(selectItrLines)

  useSignalPoints()
  useItrData()

  // Both the generic signal layers and the ITR feeds are filtered by the same
  // per-layer toggles, so they can share the marker and polygon renderers.
  const visibleItrPoints = itrPoints.filter((point) => layerEnabled[point.layerId])
  const visibleItrAreas = itrAreas.filter((area) => layerEnabled[area.layerId])
  const visibleItrLines = itrLines.filter((line) => layerEnabled[line.layerId])

  const handleHover = useCallback(
    (clusterId: string | null) => {
      dispatch(hoverCluster(clusterId))
    },
    [dispatch],
  )

  const handleSelect = useCallback(
    (cluster: Cluster) => {
      dispatch(selectCluster(cluster.id))
      void navigate(`/watch/${cluster.watchId}`)
    },
    [dispatch, navigate],
  )

  useClusterMarkers({
    map,
    clusters,
    enabled,
    hoveredClusterId,
    selectedClusterId,
    isLight,
    onHover: handleHover,
    onSelect: handleSelect,
  })

  usePointLayer(map, points)
  usePointLayer(map, visibleItrPoints)
  useAreaLayer(map, visibleItrAreas)
  useLineLayer(map, visibleItrLines)
  useDayNightLayer(map, layerEnabled.day_night)
  useGraticuleLayer(map, layerEnabled.graticule)

  return <div ref={containerRef} className="absolute inset-0 z-0 bg-sea" />
}
