import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import MapGL, { ScaleControl, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre'
import { useMapController } from '@/components/monitoring/MapContext'
import { AreaLayers } from '@/components/monitoring/layers/AreaLayers'
import { LineLayers } from '@/components/monitoring/layers/LineLayers'
import { ClusterMarkers, ReportingMarkers } from '@/components/monitoring/layers/ClusterMarkers'
import { PointMarkers } from '@/components/monitoring/layers/PointMarkers'
import { CameraMarkers } from '@/components/monitoring/layers/CameraMarkers'
import { DayNightLayer } from '@/components/monitoring/layers/DayNightLayer'
import { GraticuleLayer } from '@/components/monitoring/layers/GraticuleLayer'
import { FeatureTooltip, MapTooltip } from '@/components/monitoring/FeatureTooltip'
import { AircraftTooltip } from '@/components/monitoring/AircraftTooltip'
import { useFeatureHover } from '@/hooks/useFeatureHover'
import { useMapCamera } from '@/hooks/useMapCamera'
import { useProjectionPitch } from '@/hooks/useProjectionPitch'
import { useTerrain } from '@/hooks/useTerrain'
import { useAircraftLayer } from '@/hooks/useAircraftLayer'
import { useAircraftTrail } from '@/hooks/useAircraftTrail'
import { useItrData } from '@/hooks/useItrData'
import { useOutcomeData } from '@/hooks/useOutcomeData'
import { useSignalPoints } from '@/hooks/useSignalPoints'
import { useCameraRegistry } from '@/hooks/useCameraRegistry'
import { selectItrAreas, selectItrLines, selectItrPoints, selectSocialClusters } from '@/store/slices/itrSlice'
import { selectClosureAreas } from '@/store/slices/outcomeSlice'
import type { Cluster, DataLayerId } from '@/types/monitoring'
import { useAppDispatch, useAppSelector } from '@/store/store'
import {
  hoverCluster,
  selectClusters,
  selectCluster,
  selectEnabled,
  selectHoveredClusterId,
  selectSelectedClusterId,
} from '@/store/slices/monitoringSlice'
import { selectBasemap, selectLayerEnabled, selectProjection, selectVisiblePoints } from '@/store/slices/layersSlice'
import { selectFlight, selectSelectedFlightHex } from '@/store/slices/flightsSlice'
import { selectVisibleCameras } from '@/store/slices/camerasSlice'
import { selectTheme } from '@/store/slices/themeSlice'
import { BASEMAPS, INITIAL_VIEW, MAX_PITCH, MAX_ZOOM, MIN_ZOOM, SKY } from '@/utils/constants'
import { basemapStyle } from '@/utils/mapStyle'
import { HOVERABLE_LAYER_IDS } from '@/utils/mapLayers'
import { WATCHES_ENABLED, dataLayer } from '@/utils/layers'

/** Stable empty array — a fresh `[]` each render would re-feed the sources. */
const NO_CLUSTERS: Cluster[] = []

/**
 * Tilt, in degrees, past which extruded volumes are worth drawing.
 *
 * Below this the camera is close enough to straight down that a volume and its
 * footprint are the same picture. The globe's own resting tilt is 14°, so this
 * sits just under it — switching to the globe reveals the volumes.
 */
const EXTRUSION_MIN_PITCH = 10

/**
 * The map itself — the product surface every other panel floats above.
 *
 * react-map-gl creates the MapLibre instance and hands it to `MapProvider`
 * through `onReady`; everything drawn on it is a child component here. There is
 * no imperative layer reconciliation left: React diffs the markers and the
 * GeoJSON sources, which is what replaced six hooks of ref-keyed bookkeeping.
 */
export function MapCanvas() {
  const { onReady } = useMapController()
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
  const basemapId = useAppSelector(selectBasemap)
  const projection = useAppSelector(selectProjection)
  // Marker contrast follows the basemap, not the chrome theme — the markers are
  // drawn on the tiles, not on the panels.
  const isLight = BASEMAPS[basemapId].isLight
  // The sky is the exception: it is *not* part of the basemap, it is the space
  // around the globe, so it follows the chrome theme like every other surface.
  const theme = useAppSelector(selectTheme)
  const points = useAppSelector(selectVisiblePoints)
  const layerEnabled = useAppSelector(selectLayerEnabled)
  const itrPoints = useAppSelector(selectItrPoints)
  const itrAreas = useAppSelector(selectItrAreas)
  const closureAreas = useAppSelector(selectClosureAreas)
  const itrLines = useAppSelector(selectItrLines)
  const socialClusters = useAppSelector(selectSocialClusters)
  const selectedFlightHex = useAppSelector(selectSelectedFlightHex)
  const cameras = useAppSelector(selectVisibleCameras)

  useSignalPoints()
  useItrData()
  // The after-action captures. Needed here for the verified-closure layer, and
  // by the resolution banner in the chrome.
  useOutcomeData()
  // The only layer that re-fetches as the camera moves. No-op while it is off.
  useCameraRegistry()
  useProjectionPitch(projection)
  useTerrain(layerEnabled.terrain)
  useAircraftLayer(layerEnabled.itr_aircraft)
  // The trail follows whichever dossier is open, and only that one.
  useAircraftTrail(layerEnabled.itr_aircraft ? selectedFlightHex : null)

  const hoveredFeature = useFeatureHover(HOVERABLE_LAYER_IDS)
  // Aircraft carry only a `hex`; the tooltip resolves the rest from the store.
  const hoveredAircraftHex =
    hoveredFeature?.props.layerId === 'itr_aircraft' ? ((hoveredFeature.props as { hex?: string }).hex ?? null) : null

  // Extruded volumes are only mounted once the camera is actually tilted. Straight
  // down, an extrusion looks exactly like its own footprint.
  const { pitch } = useMapCamera()
  const tilted = pitch > EXTRUSION_MIN_PITCH

  const mapStyle = useMemo(() => basemapStyle(basemapId), [basemapId])

  // Both the generic signal layers and the ITR feeds are filtered by the same
  // per-layer toggles, so they can share the marker and polygon renderers.
  const visiblePoints = useMemo(
    () => [...points, ...itrPoints.filter((point) => layerEnabled[point.layerId])],
    [points, itrPoints, layerEnabled],
  )
  // The verified closure is appended rather than merged upstream: it comes from
  // the after-action capture, not from a live feed, and it is drawn last so it
  // sits over the danger-area box it corrects.
  const visibleAreas = useMemo(
    () => [...itrAreas, ...closureAreas].filter((area) => layerEnabled[area.layerId]),
    [itrAreas, closureAreas, layerEnabled],
  )
  const visibleLines = useMemo(() => itrLines.filter((line) => layerEnabled[line.layerId]), [itrLines, layerEnabled])

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

  // Reporting clusters open the site's posts rather than a watch.
  const socialEnabled = useMemo(
    () => Object.fromEntries(socialClusters.map((cluster) => [cluster.watchId, layerEnabled.itr_social])),
    [socialClusters, layerEnabled.itr_social],
  )

  const handleSocialSelect = useCallback(
    (cluster: Cluster) => {
      dispatch(selectCluster(cluster.id))
      void navigate(`/site/${cluster.watchId}`)
    },
    [dispatch, navigate],
  )

  // The pointer must read as clickable over a cluster but not over a danger area,
  // which is context. Areas and lines get a tooltip and nothing else; an aircraft
  // opens a dossier, so it gets a pointer rather than the `help` cursor.
  const handleMouseMove = useCallback((event: MapLayerMouseEvent) => {
    const [feature] = event.features ?? []
    const cursor = !feature ? '' : feature.properties?.layerId === 'itr_aircraft' ? 'pointer' : 'help'
    event.target.getCanvas().style.cursor = cursor
  }, [])

  // Clicking a contact opens its dossier. Selection is mirrored into the store so
  // the map can ring the aircraft the open panel is about.
  const handleMapClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const aircraft = event.features?.find((feature) => feature.properties?.layerId === 'itr_aircraft')
      const hex = aircraft?.properties?.hex
      if (typeof hex !== 'string') return

      dispatch(selectFlight(hex))
      void navigate(`/aircraft/${hex}`)
    },
    [dispatch, navigate],
  )

  // Hand the instance to `MapProvider` on mount, and clear it on unmount so a
  // remount never leaves the chrome holding a destroyed map.
  const handleRef = useCallback(
    (ref: MapRef | null) => {
      onReady(ref ? ref.getMap() : null)
    },
    [onReady],
  )

  return (
    /*
     * Two elements, not one, and that is load-bearing.
     *
     * MapLibre's stylesheet sets `.maplibregl-map { position: relative }`
     * unlayered, and Tailwind v4 emits its utilities inside `@layer utilities` —
     * where an unlayered rule wins whatever the source order or specificity. Put
     * `absolute inset-0` straight on the map container and MapLibre silently
     * overrides it, collapsing the map to zero height and rendering nothing, with
     * no error. That is what sank the first attempt at this migration.
     *
     * So the *wrapper* is what Tailwind positions, and the map container inside it
     * takes its size from an inline style — which no stylesheet can override.
     */
    <div className="absolute inset-0 z-0 bg-sea">
      <MapGL
        // `initialViewState`, not `viewState`: the camera is MapLibre's to own.
        // Driving it from React state would re-render the tree on every frame of
        // a pan, and `useMapUrlState` already mirrors it into the query string.
        initialViewState={{
          latitude: INITIAL_VIEW.center[0],
          longitude: INITIAL_VIEW.center[1],
          zoom: INITIAL_VIEW.zoom,
        }}
        mapStyle={mapStyle}
        projection={projection}
        // Sky is declared even in Mercator: MapLibre ignores the atmosphere there,
        // but keeping it set means switching to the globe does not have to wait
        // for a second style update to look right.
        sky={SKY[theme]}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        // Raised from MapLibre's default 60 so the camera can look *along* a range
        // rather than only down at it — which is the whole point of the tilt.
        maxPitch={MAX_PITCH}
        // The rails supply their own zoom buttons, positioned clear of the chrome,
        // so no NavigationControl is mounted.
        attributionControl={{ compact: false }}
        interactiveLayerIds={HOVERABLE_LAYER_IDS}
        onMouseMove={handleMouseMove}
        onClick={handleMapClick}
        /*
         * The instance is taken from the ref, not from `onLoad`.
         *
         * `load` is a one-shot event, and under StrictMode's mount → unmount →
         * remount it can be missed entirely — leaving `MapProvider.map` null
         * forever, so no layer, marker or chrome control ever binds and the map
         * renders as an empty canvas with no error to show for it.
         *
         * A ref fires on every mount and carries the instance whether or not the
         * style has finished loading. Everything downstream that needs a loaded
         * style already checks for one (`useTerrain`, `useFeatureHover`), so this
         * is both the earlier and the more reliable signal.
         */
        ref={handleRef}
        onError={(event) => console.error('MapLibre:', event.error?.message ?? event.error ?? event)}
        style={{ width: '100%', height: '100%' }}
      >
        <ScaleControl position="bottom-left" unit="metric" maxWidth={120} />

        {/*
          Draw order is the mount order of these children, and it is deliberate:
          the display washes go down first, then areas, then the lines that assert
          a direction over them. Markers are DOM and always sit above all of it.
        */}
        {layerEnabled.day_night && <DayNightLayer />}
        {layerEnabled.graticule && <GraticuleLayer />}
        <AreaLayers areas={visibleAreas} extruded={tilted} isLight={isLight} />
        <LineLayers lines={visibleLines} />

        <ReportingMarkers
          clusters={socialClusters}
          enabled={socialEnabled}
          hoveredClusterId={hoveredClusterId}
          selectedClusterId={selectedClusterId}
          onHover={handleHover}
          onSelect={handleSocialSelect}
        />
        <PointMarkers points={visiblePoints} />
        {/*
          Above the plotted points and below the watch clusters — see `CAMERA_Z`. A
          camera is clickable so it must not sit under a marker that is merely
          hoverable, but eighty of them over a city must never bury the target's own
          sites and warnings.
        */}
        {layerEnabled.cctv && <CameraMarkers cameras={cameras} />}
        <ClusterMarkers
          clusters={clusters}
          enabled={enabled}
          hoveredClusterId={hoveredClusterId}
          selectedClusterId={selectedClusterId}
          isLight={isLight}
          onHover={handleHover}
          onSelect={handleSelect}
        />

        {hoveredFeature && (
          <MapTooltip lat={hoveredFeature.lat} lng={hoveredFeature.lng}>
            {hoveredAircraftHex ? (
              <AircraftTooltip hex={hoveredAircraftHex} />
            ) : (
              <FeatureTooltip
                layerId={hoveredFeature.props.layerId as DataLayerId}
                title={hoveredFeature.props.label}
                detail={hoveredFeature.props.detail || undefined}
                meta={dataLayer(hoveredFeature.props.layerId as DataLayerId)?.label}
              />
            )}
          </MapTooltip>
        )}
      </MapGL>
    </div>
  )
}
