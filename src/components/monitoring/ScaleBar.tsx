import { useEffect } from 'react'
import L from 'leaflet'
import { useMapController } from '@/components/monitoring/MapContext'

/**
 * Distance scale, bottom-left of the map.
 *
 * Leaflet's own control already does the hard part — picking a round distance
 * for the current latitude and zoom — so this only mounts it and lets
 * `index.css` restyle it to match the chrome.
 */
export function ScaleBar() {
  const { map } = useMapController()

  useEffect(() => {
    if (!map) return

    const control = L.control.scale({ position: 'bottomleft', metric: true, imperial: false, maxWidth: 120 })
    control.addTo(map)

    return () => {
      control.remove()
    }
  }, [map])

  return null
}
