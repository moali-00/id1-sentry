import { useEffect, useRef, useState } from 'react'
import type { MapMouseEvent } from 'maplibre-gl'
import { useMapController } from '@/components/monitoring/MapContext'
import { Panel } from '@/components/ui/Panel'

interface Readout {
  lat: number
  lng: number
}

/** `24.8600°N 67.0000°E` — the form used throughout the detail panel. */
function formatPair({ lat, lng }: Readout): string {
  const ns = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`
  // Longitudes wrap when the map is panned past a date line; normalise first.
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180
  const ew = `${Math.abs(wrapped).toFixed(4)}°${wrapped >= 0 ? 'E' : 'W'}`
  return `${ns}  ${ew}`
}

/**
 * Cursor position and zoom, bottom-right.
 *
 * Falls back to the map centre when the pointer leaves the canvas, so the
 * readout is never blank — an operator reading off a coordinate should not have
 * to keep the mouse still to do it.
 */
export function CoordinateReadout() {
  const { map } = useMapController()
  const [position, setPosition] = useState<Readout | null>(null)
  const [zoom, setZoom] = useState<number | null>(null)
  const [tracking, setTracking] = useState(false)
  // Read inside the map handlers so the listeners bind once, rather than being
  // torn down and rebuilt every time the pointer enters or leaves.
  const trackingRef = useRef(false)

  useEffect(() => {
    if (!map) return

    const centre = () => setPosition({ lat: map.getCenter().lat, lng: map.getCenter().lng })

    const handleMove = (event: MapMouseEvent) => {
      trackingRef.current = true
      setTracking(true)
      setPosition({ lat: event.lngLat.lat, lng: event.lngLat.lng })
    }

    const handleOut = () => {
      trackingRef.current = false
      setTracking(false)
      centre()
    }

    const handleMoveEnd = () => {
      if (!trackingRef.current) centre()
    }

    const handleZoom = () => setZoom(map.getZoom())

    centre()
    handleZoom()
    map.on('mousemove', handleMove)
    map.on('mouseout', handleOut)
    map.on('moveend', handleMoveEnd)
    map.on('zoomend', handleZoom)

    // Named handlers throughout: `map.off('moveend')` with no handler would
    // also unbind the URL-sync listener.
    return () => {
      map.off('mousemove', handleMove)
      map.off('mouseout', handleOut)
      map.off('moveend', handleMoveEnd)
      map.off('zoomend', handleZoom)
    }
  }, [map])

  if (!position) return null

  return (
    <Panel className="absolute right-4 bottom-4 flex items-center gap-2.5 px-3 py-1.5">
      <span className="numeric text-[11px] text-fg">{formatPair(position)}</span>
      <span className="h-3 w-px bg-line" aria-hidden />
      {/* Zoom is fractional now, so it is fixed to one place rather than
          printing a long float as the wheel moves. */}
      <span className="numeric text-[11px] text-fg-muted">z{zoom?.toFixed(1) ?? '–'}</span>
      <span className="label-micro text-fg-subtle">{tracking ? 'CURSOR' : 'CENTRE'}</span>
    </Panel>
  )
}
