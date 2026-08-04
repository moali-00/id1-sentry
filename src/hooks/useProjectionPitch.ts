import { useEffect, useRef } from 'react'
import { useMapController } from '@/components/monitoring/MapContext'
import { GLOBE_PITCH, type ProjectionId } from '@/utils/constants'

/** Long enough to read as the camera moving, short enough not to feel like a wait. */
const TILT_MS = 600

/**
 * Tilt the camera when the operator switches to the globe, and level it coming back.
 *
 * A globe seen dead-on from above reads as a circular map rather than a sphere;
 * a few degrees of pitch is what makes the curvature legible. Mercator gets zero,
 * because a tilted flat map buys nothing and costs legibility at the top of the
 * frame.
 *
 * Deliberately skips the first run. On a cold load `useMapUrlState` may be about
 * to restore an explicit `pitch=` from a shared link, and that must win over the
 * default for the mode.
 */
export function useProjectionPitch(projection: ProjectionId): void {
  const { map } = useMapController()
  const previous = useRef<ProjectionId | null>(null)

  useEffect(() => {
    if (!map) return

    const changed = previous.current !== null && previous.current !== projection
    previous.current = projection
    if (!changed) return

    map.easeTo({ pitch: projection === 'globe' ? GLOBE_PITCH : 0, duration: TILT_MS })
  }, [map, projection])
}
