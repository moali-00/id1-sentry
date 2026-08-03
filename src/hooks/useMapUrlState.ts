import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DATA_LAYERS } from '@/utils/layers'
import { MAX_ZOOM, MIN_ZOOM } from '@/utils/constants'
import { useMapController } from '@/components/monitoring/MapContext'
import { selectActiveLayerIds, setEnabledLayers } from '@/store/slices/layersSlice'
import { useAppDispatch, useAppSelector } from '@/store/store'
import type { DataLayerId } from '@/types/monitoring'

/**
 * Mirror the map view and layer selection into the query string.
 *
 * `/watch/:id` already makes an open investigation shareable; this makes the
 * view around it shareable too, so a link carries the whole picture the sender
 * was looking at rather than a topic floating over an arbitrary camera.
 *
 * Restore runs once, before the first write-back, so the URL always wins over
 * the defaults on a cold load.
 */

const LAT_KEY = 'lat'
const LON_KEY = 'lon'
const ZOOM_KEY = 'zoom'
const LAYERS_KEY = 'layers'

const KNOWN_LAYER_IDS = new Set<string>(DATA_LAYERS.map((layer) => layer.id))

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

    if (lat !== null && lng !== null) map.setView([lat, lng], zoom ?? map.getZoom(), { animate: false })
    else if (zoom !== null) map.setZoom(zoom, { animate: false })

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

    return () => {
      map.off('moveend', sync)
      map.off('zoomend', sync)
    }
  }, [map, activeLayerIds])
}
