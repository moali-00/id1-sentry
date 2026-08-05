import { useEffect } from 'react'
import type { GeoJSONSource } from 'maplibre-gl'
import type { FeatureCollection, LineString } from 'geojson'
import { useMapController } from '@/components/monitoring/MapContext'
import { fetchAircraftTrack } from '@/api/flights'
import { AIRCRAFT_TRAIL_LAYER_ID, AIRCRAFT_TRAIL_SOURCE_ID } from '@/utils/mapLayers'

/**
 * The path an aircraft has already flown, behind the one with an open dossier.
 *
 * Only ever one trail. Drawing all forty would be a bowl of spaghetti that hides
 * the traffic it is describing, and the question a trail answers — where has this
 * one been, is it turning, is it holding — is only ever asked about the aircraft
 * being inspected.
 *
 * Server-side history is in-memory and starts when the aircraft enters the region,
 * so a contact that just arrived legitimately has almost no trail. That is not an
 * error state and is not reported as one.
 */

/** The trail extends while the aircraft flies, so it is re-read periodically. */
const REFRESH_MS = 10_000

const EMPTY: FeatureCollection<LineString> = { type: 'FeatureCollection', features: [] }

export function useAircraftTrail(hex: string | null): void {
  const { map } = useMapController()

  useEffect(() => {
    if (!map) return

    const remove = () => {
      if (map.getLayer(AIRCRAFT_TRAIL_LAYER_ID)) map.removeLayer(AIRCRAFT_TRAIL_LAYER_ID)
      if (map.getSource(AIRCRAFT_TRAIL_SOURCE_ID)) map.removeSource(AIRCRAFT_TRAIL_SOURCE_ID)
    }

    if (!hex) {
      remove()
      return
    }

    // A style swap drops the source, so this re-runs on `style.load` like every
    // other imperative layer.
    const apply = () => {
      if (!map.getSource(AIRCRAFT_TRAIL_SOURCE_ID)) {
        map.addSource(AIRCRAFT_TRAIL_SOURCE_ID, { type: 'geojson', data: EMPTY })
      }
      if (!map.getLayer(AIRCRAFT_TRAIL_LAYER_ID)) {
        map.addLayer({
          id: AIRCRAFT_TRAIL_LAYER_ID,
          type: 'line',
          source: AIRCRAFT_TRAIL_SOURCE_ID,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#51a2ff',
            'line-width': 1.5,
            // Faint: this is where the aircraft *was*, and it must not compete
            // with the danger areas and corridors it flies across.
            'line-opacity': 0.55,
          },
        })
      }
    }

    if (map.isStyleLoaded()) apply()
    map.on('style.load', apply)

    const controller = new AbortController()

    const load = async () => {
      try {
        const track = await fetchAircraftTrack(hex, undefined, { signal: controller.signal })
        if (controller.signal.aborted) return

        const source = map.getSource(AIRCRAFT_TRAIL_SOURCE_ID) as GeoJSONSource | undefined
        if (!source) return

        // Two points are the minimum for a line; one is not a path.
        const coordinates = (track?.points ?? []).map((point): [number, number] => [point.lon, point.lat])
        source.setData(
          coordinates.length < 2
            ? EMPTY
            : {
                type: 'FeatureCollection',
                features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }],
              },
        )
      } catch {
        // A trail is an enhancement. Losing it leaves the aircraft and its dossier
        // intact, so a failure here says nothing to the operator.
      }
    }

    void load()
    const timer = window.setInterval(() => void load(), REFRESH_MS)

    return () => {
      controller.abort()
      window.clearInterval(timer)
      map.off('style.load', apply)
      remove()
    }
  }, [map, hex])
}
