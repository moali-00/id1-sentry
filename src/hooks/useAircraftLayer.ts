import { useEffect } from 'react'
import type { ExpressionSpecification, GeoJSONSource } from 'maplibre-gl'
import type { Feature, FeatureCollection, Point } from 'geojson'
import { useMapController } from '@/components/monitoring/MapContext'
import { useAppStore } from '@/store/store'
import type { RootState } from '@/store/store'
import { AIRCRAFT_ICON_SCALE, aircraftIconId, aircraftIconImage } from '@/utils/aircraftIcon'
import { ALTITUDE_BANDS, BAND_COLOR, altitudeBand, hasHeading, headingDegrees, isStale, projectAircraft } from '@/utils/flights'
import {
  AIRCRAFT_DOT_LAYER_ID,
  AIRCRAFT_HALO_LAYER_ID,
  AIRCRAFT_SOURCE_ID,
  AIRCRAFT_SYMBOL_LAYER_ID,
} from '@/utils/mapLayers'

/**
 * Live aircraft on the map, dead-reckoned between fixes.
 *
 * Imperative, for the same two reasons `useTerrain` is: **switching basemap
 * replaces the whole style**, taking every source and layer with it, so this
 * re-applies itself on `style.load`; and the positions change every frame, which
 * through React would mean re-rendering the tree at frame rate.
 *
 * The animation loop reads the store *imperatively* — `store.getState()` inside
 * the frame, not `useAppSelector` — so a 2-second stream cadence drives Redux
 * while a 25 fps render loop drives the map, and neither is coupled to the other.
 * That separation is the whole design: subscribing a component to 40 aircraft
 * positions would re-render the dashboard twice a second for no visible gain.
 */

/**
 * Render interval, ms — about 25 fps.
 *
 * Rebuilding a 40-feature collection and re-parsing it costs real main-thread
 * time, and this is competing with a globe and 3D terrain for it. 25 fps is
 * indistinguishable from 60 for objects moving at map scale (it is faster than
 * film) and costs less than half as much.
 */
const FRAME_MS = 40

/** `['match', ['get','band'], 'ground', '#6a7282', …, fallback]`. */
const bandColorExpression = (): ExpressionSpecification =>
  [
    'match',
    ['get', 'band'],
    ...ALTITUDE_BANDS.flatMap((band) => [band, BAND_COLOR[band]]),
    BAND_COLOR.ground,
  ] as unknown as ExpressionSpecification

/** Properties kept deliberately thin — rebuilt 25 times a second. */
interface AircraftFeatureProps {
  hex: string
  /** Lets the shared hover path recognise which data layer this belongs to. */
  layerId: 'itr_aircraft'
  band: string
  heading: number
  hasHeading: boolean
  stale: boolean
  selected: boolean
}

/**
 * Snapshot the contact set as GeoJSON, projected forward to this instant.
 *
 * Only `hex` identifies the feature — no labels, no formatted values. The tooltip
 * looks the aircraft up in the store when it needs those, so the numbers it shows
 * are current rather than whatever was baked in at the last frame, and the
 * per-frame cost stays down to one small object per aircraft.
 */
function buildCollection(flights: RootState['flights'], now: number): FeatureCollection<Point, AircraftFeatureProps> {
  const features: Feature<Point, AircraftFeatureProps>[] = []

  for (const aircraft of Object.values(flights.byHex)) {
    const timing = flights.timing[aircraft.hex]
    // Without timing there is nothing to project from; draw the reported fix.
    const elapsed = timing ? timing.ageAtReceipt + (now - timing.receivedAt) : 0

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: projectAircraft(aircraft, elapsed) },
      properties: {
        hex: aircraft.hex,
        layerId: 'itr_aircraft',
        band: altitudeBand(aircraft),
        heading: headingDegrees(aircraft),
        hasHeading: hasHeading(aircraft),
        stale: isStale(aircraft),
        selected: aircraft.hex === flights.selectedHex,
      },
    })
  }

  return { type: 'FeatureCollection', features }
}

const EMPTY: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] }

export function useAircraftLayer(enabled: boolean): void {
  const { map } = useMapController()
  const store = useAppStore()

  useEffect(() => {
    if (!map) return

    const removeLayers = () => {
      for (const id of [AIRCRAFT_HALO_LAYER_ID, AIRCRAFT_DOT_LAYER_ID, AIRCRAFT_SYMBOL_LAYER_ID]) {
        if (map.getLayer(id)) map.removeLayer(id)
      }
      if (map.getSource(AIRCRAFT_SOURCE_ID)) map.removeSource(AIRCRAFT_SOURCE_ID)
    }

    if (!enabled) {
      removeLayers()
      return
    }

    const apply = () => {
      // Icons live on the style, so a style swap loses them too — re-registered
      // here rather than once on mount.
      for (const band of ALTITUDE_BANDS) {
        const id = aircraftIconId(band)
        if (map.hasImage(id)) continue
        const image = aircraftIconImage(band)
        // No 2D context available: the dot layer below still renders every
        // aircraft, just without a heading.
        if (image) map.addImage(id, image, { pixelRatio: 2 })
      }

      if (!map.getSource(AIRCRAFT_SOURCE_ID)) {
        map.addSource(AIRCRAFT_SOURCE_ID, { type: 'geojson', data: EMPTY })
      }

      // A ring around the aircraft behind an open detail panel, so the map and the
      // panel are visibly about the same contact.
      if (!map.getLayer(AIRCRAFT_HALO_LAYER_ID)) {
        map.addLayer({
          id: AIRCRAFT_HALO_LAYER_ID,
          type: 'circle',
          source: AIRCRAFT_SOURCE_ID,
          filter: ['==', ['get', 'selected'], true],
          paint: {
            'circle-radius': 15,
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#51a2ff',
            'circle-stroke-opacity': 0.9,
          },
        })
      }

      // Contacts with no reported track. Drawn as a plain dot rather than a
      // pointing aircraft, which would assert a direction nobody transmitted.
      if (!map.getLayer(AIRCRAFT_DOT_LAYER_ID)) {
        map.addLayer({
          id: AIRCRAFT_DOT_LAYER_ID,
          type: 'circle',
          source: AIRCRAFT_SOURCE_ID,
          filter: ['==', ['get', 'hasHeading'], false],
          paint: {
            'circle-radius': 4,
            'circle-color': bandColorExpression(),
            'circle-opacity': ['case', ['get', 'stale'], 0.4, 0.95],
            'circle-stroke-width': 1,
            'circle-stroke-color': 'rgba(13,17,23,0.9)',
          },
        })
      }

      if (!map.getLayer(AIRCRAFT_SYMBOL_LAYER_ID)) {
        map.addLayer({
          id: AIRCRAFT_SYMBOL_LAYER_ID,
          type: 'symbol',
          source: AIRCRAFT_SOURCE_ID,
          filter: ['==', ['get', 'hasHeading'], true],
          layout: {
            'icon-image': ['concat', 'aircraft-', ['get', 'band']],
            'icon-size': AIRCRAFT_ICON_SCALE,
            'icon-rotate': ['get', 'heading'],
            // Rotate with the map, so a bearing stays true when the camera does.
            'icon-rotation-alignment': 'map',
            // Both required. MapLibre's symbol placement hides colliding icons by
            // default, which over an airway would silently drop half the traffic —
            // and dropping aircraft from a monitoring display is not a trade the
            // renderer gets to make.
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {
            'icon-opacity': ['case', ['get', 'stale'], 0.4, 1],
          },
        })
      }
    }

    if (map.isStyleLoaded()) apply()
    map.on('style.load', apply)

    let last = 0
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick)
      if (time - last < FRAME_MS) return
      last = time

      const source = map.getSource(AIRCRAFT_SOURCE_ID) as GeoJSONSource | undefined
      // Absent between a style swap and `apply` re-adding it.
      if (!source) return
      source.setData(buildCollection(store.getState().flights, performance.now()))
    }
    let frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      map.off('style.load', apply)
      removeLayers()
    }
  }, [map, enabled, store])
}
