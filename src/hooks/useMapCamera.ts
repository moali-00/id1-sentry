import { useEffect, useState } from 'react'
import { useMapController } from '@/components/monitoring/MapContext'

export interface CameraAttitude {
  /** Degrees clockwise from north. */
  bearing: number
  /** Degrees of tilt from straight down. */
  pitch: number
}

/**
 * The camera's attitude, as React state.
 *
 * Bound to the `*end` events rather than the continuous ones. The only consumer
 * is the compass, which needs to know *that* the view is off-north — not to
 * animate through every frame of the drag that got it there.
 */
export function useMapCamera(): CameraAttitude {
  const { map } = useMapController()
  const [attitude, setAttitude] = useState<CameraAttitude>({ bearing: 0, pitch: 0 })

  useEffect(() => {
    if (!map) return

    const sync = () => setAttitude({ bearing: map.getBearing(), pitch: map.getPitch() })
    sync()
    map.on('rotateend', sync)
    map.on('pitchend', sync)
    // A fly-to from a preset changes both without any drag to end.
    map.on('moveend', sync)

    return () => {
      map.off('rotateend', sync)
      map.off('pitchend', sync)
      map.off('moveend', sync)
    }
  }, [map])

  return attitude
}
