import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DATA_LAYERS } from '@/utils/layers'
import { MAX_PITCH, MAX_ZOOM, MIN_ZOOM, type ProjectionId } from '@/utils/constants'
import { useMapController } from '@/components/monitoring/MapContext'
import { selectActiveLayerIds, selectProjection, setEnabledLayers, setProjection } from '@/store/slices/layersSlice'
import { useAppDispatch, useAppSelector } from '@/store/store'
import type { DataLayerId } from '@/types/monitoring'

/**
 * Mirror the map view and layer selection into the query string.
 *
 * `/watch/:id` already makes an open investigation shareable; this makes the
 * view around it shareable too, so a link carries the whole picture the sender
 * was looking at rather than a topic floating over an arbitrary camera.
 *
 * Since the camera gained a third dimension, "the whole picture" includes the
 * tilt, the heading and whether the surface is a plane or a sphere — a globe view
 * pitched over the downrange fan restores as a flat north-up map without them.
 *
 * Restore runs once, before the first write-back, so the URL always wins over
 * the defaults on a cold load.
 */

const LAT_KEY = 'lat'
const LON_KEY = 'lon'
const ZOOM_KEY = 'zoom'
const PITCH_KEY = 'pitch'
const BEARING_KEY = 'bearing'
const PROJECTION_KEY = 'proj'
const LAYERS_KEY = 'layers'

const KNOWN_LAYER_IDS = new Set<string>(DATA_LAYERS.map((layer) => layer.id))

const isProjection = (value: string | null): value is ProjectionId => value === 'mercator' || value === 'globe'

const finiteInRange = (value: string | null, min: number, max: number): number | null => {
  if (value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null
}

export function useMapUrlState(): void {
  const { map } = useMapController()
  const dispatch = useAppDispatch()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeLayerIds = useAppSelector(selectActiveLayerIds)
  const projection = useAppSelector(selectProjection)

  const restored = useRef(false)

  // Mirrored into refs so neither effect depends on the query string itself.
  // `setSearchParams` is re-created every time the params change, so depending
  // on it would make the write-back effect re-run its own output forever.
  // Declared first, so both are populated by the time the effects below run.
  const paramsRef = useRef(searchParams)
  const setParamsRef = useRef(setSearchParams)
  useEffect(() => {
    paramsRef.current = searchParams
    setParamsRef.current = setSearchParams
  }, [searchParams, setSearchParams])

  /** Serialised form of the last write, so an unchanged view writes nothing. */
  const lastWritten = useRef<string | null>(null)

  // ── Restore ──
  useEffect(() => {
    if (!map || restored.current) return
    restored.current = true

    const params = paramsRef.current
    const lat = finiteInRange(params.get(LAT_KEY), -90, 90)
    const lng = finiteInRange(params.get(LON_KEY), -180, 180)
    const zoom = finiteInRange(params.get(ZOOM_KEY), MIN_ZOOM, MAX_ZOOM)
    const pitch = finiteInRange(params.get(PITCH_KEY), 0, MAX_PITCH)
    const bearing = finiteInRange(params.get(BEARING_KEY), -360, 360)

    // The projection is restored before the camera. Switching it afterwards would
    // re-run `useProjectionPitch`, which applies the mode's default tilt and would
    // overwrite the pitch this link is carrying.
    const proj = params.get(PROJECTION_KEY)
    if (isProjection(proj)) dispatch(setProjection(proj))

    // `jumpTo`, not `flyTo` — a restore is where the camera already was, and
    // animating into it would read as the app moving the view on its own.
    if (lat !== null && lng !== null) {
      map.jumpTo({ center: [lng, lat], zoom: zoom ?? map.getZoom(), pitch: pitch ?? 0, bearing: bearing ?? 0 })
    } else if (zoom !== null || pitch !== null || bearing !== null) {
      map.jumpTo({ zoom: zoom ?? map.getZoom(), pitch: pitch ?? 0, bearing: bearing ?? 0 })
    }

    // Absent means "use the defaults"; present but empty means "everything off".
    const layers = params.get(LAYERS_KEY)
    if (layers !== null) {
      const ids = layers
        .split(',')
        .map((id) => id.trim())
        .filter((id) => KNOWN_LAYER_IDS.has(id)) as DataLayerId[]
      dispatch(setEnabledLayers(ids))
    }
  }, [map, dispatch])

  // ── Write back ──
  useEffect(() => {
    if (!map) return

    const sync = () => {
      if (!restored.current) return
      const center = map.getCenter()

      const next = new URLSearchParams(paramsRef.current)
      next.set(LAT_KEY, center.lat.toFixed(4))
      next.set(LON_KEY, center.lng.toFixed(4))
      next.set(ZOOM_KEY, map.getZoom().toFixed(2))
      next.set(LAYERS_KEY, activeLayerIds.join(','))
      next.set(PROJECTION_KEY, projection)

      // Only written when they are not at rest. A flat, north-up view is what the
      // dashboard opens in, and spelling that out in every shared link would put
      // two dead parameters in front of the ones that matter.
      const pitch = map.getPitch()
      const bearing = map.getBearing()
      if (pitch > 0.5) next.set(PITCH_KEY, pitch.toFixed(1))
      else next.delete(PITCH_KEY)
      if (Math.abs(bearing) > 0.5) next.set(BEARING_KEY, bearing.toFixed(1))
      else next.delete(BEARING_KEY)

      // Writing an identical query string would still produce a new location
      // object, re-running this effect on its own output.
      const serialised = next.toString()
      if (serialised === lastWritten.current) return
      lastWritten.current = serialised

      // History is for navigation between watches — panning the map should not
      // fill it with entries the Back button has to walk through.
      setParamsRef.current(next, { replace: true })
    }

    sync()
    map.on('moveend', sync)
    map.on('zoomend', sync)
    // Bound explicitly rather than relying on `moveend` to cover them: a tilt or a
    // rotation that does not shift the centre is still a different view to share.
    map.on('pitchend', sync)
    map.on('rotateend', sync)

    return () => {
      map.off('moveend', sync)
      map.off('zoomend', sync)
      map.off('pitchend', sync)
      map.off('rotateend', sync)
    }
  }, [map, activeLayerIds, projection])
}
