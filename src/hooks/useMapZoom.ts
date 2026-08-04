import { useEffect, useState } from 'react'
import { useMapController } from '@/components/monitoring/MapContext'

/**
 * The map's zoom, as React state.
 *
 * Bound to `zoomend` rather than `zoom`: the latter fires every animation frame,
 * and the only consumer is marker sizing, which does not need to resize mid-wheel.
 * A settled value keeps a re-render off the critical path of a pinch or a fly-to.
 */
export function useMapZoom(fallback = 4): number {
  const { map } = useMapController()
  const [zoom, setZoom] = useState(fallback)

  useEffect(() => {
    if (!map) return

    const sync = () => setZoom(map.getZoom())
    sync()
    map.on('zoomend', sync)
    return () => {
      map.off('zoomend', sync)
    }
  }, [map])

  return zoom
}
