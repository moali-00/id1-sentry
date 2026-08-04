import { layerColor } from '@/utils/layers'
import { withAlpha } from '@/utils/color'
import { AIRCRAFT_SIZE, DEFAULT_SEVERITY, POINT_SIZES } from '@/utils/markerGeometry'
import type { MapPoint } from '@/types/monitoring'

/**
 * An arrowhead for a moving contact.
 *
 * A dot would throw away the two most useful things ADS-B reports: which way the
 * aircraft is going, and therefore whether it is routing around the range. The
 * glyph points north at 0°, matching the `true_track` convention — the rotation
 * itself is applied by the `<Marker>`, which can align it to the map so the
 * heading stays true when the camera is rotated.
 */
function AircraftGlyph({ point, active }: { point: MapPoint; active: boolean }) {
  const color = layerColor(point.layerId)

  return (
    <svg
      width={AIRCRAFT_SIZE}
      height={AIRCRAFT_SIZE}
      viewBox="0 0 16 16"
      style={{ display: 'block', filter: active ? `drop-shadow(0 0 3px ${color})` : undefined }}
      aria-hidden
    >
      <path
        d="M8 1 L13.5 14 L8 11 L2.5 14 Z"
        fill={color}
        stroke={withAlpha('#ffffff', 0.85)}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * A signal-layer point.
 *
 * Visually subordinate to cluster markers by design: watches are the operator's
 * own subject, and context layers must not compete with them. Hence a plain dot
 * with a soft ring rather than a bordered, labelled circle.
 */
export function PointMarker({ point, active, scale = 1 }: { point: MapPoint; active: boolean; scale?: number }) {
  if (point.layerId === 'itr_aircraft' && point.bearingDeg !== undefined) {
    return <AircraftGlyph point={point} active={active} />
  }

  const color = layerColor(point.layerId)
  const severity = Math.min(POINT_SIZES.length - 1, Math.max(0, Math.round(point.severity ?? DEFAULT_SEVERITY)))

  // Thermal is the densest layer and the least significant — 28 detections that
  // are almost all agricultural burning. Drawing it subordinate is both the
  // declutter and the honest weighting.
  const weight = point.layerId === 'itr_thermal' ? 0.7 : 1
  const size = Math.max(5, Math.round(POINT_SIZES[severity] * scale * weight))

  // The monitored sites get a slow, wide halo so the eye lands on the subject
  // before it starts reading the context layers around it.
  const isSite = point.layerId === 'itr_sites'

  return (
    <div
      className={isSite ? 'sentry-ping' : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        boxSizing: 'border-box',
        background: color,
        border: `1.5px solid ${withAlpha(color, 0.9)}`,
        boxShadow: active
          ? `0 0 0 2px var(--c-ring), 0 0 0 4px ${color}`
          : `0 0 0 3px ${withAlpha(color, 0.22)}`,
        // Consumed by the `sentry-ping` keyframes.
        ...(isSite ? { ['--ping' as string]: withAlpha(color, 0.45) } : {}),
      }}
    />
  )
}
