import L, { type DivIcon } from 'leaflet'
import { categoryColor } from '@/utils/constants'
import { layerColor } from '@/utils/layers'
import type { Cluster, MapPoint } from '@/types/monitoring'
import { withAlpha } from '@/utils/color'

/** Below this diameter the count label needs a smaller type size to fit. */
const SMALL_MARKER_SIZE = 28

interface IconOptions {
  /** Hovered or selected — draws a halo ring. */
  active: boolean
  /** The fill sits lighter on the light basemap so the count stays legible. */
  isLight: boolean
}

/**
 * Build the `divIcon` for a cluster marker.
 *
 * Leaflet takes an HTML string, so this is the one place the dashboard composes
 * styles by hand instead of using Tailwind — utility classes inside a `divIcon`
 * would not be picked up by Tailwind's scanner. Theme-reactive values still come
 * from CSS custom properties (`var(--c-ring)`), which resolve normally because
 * the marker is a descendant of `<html class="dark">`.
 */
export function createClusterIcon(cluster: Cluster, { active, isLight }: IconOptions): DivIcon {
  const color = categoryColor(cluster.category)
  const { size } = cluster

  // Inferred positions are hatched rather than solid — a standing visual cue
  // that the coordinates came from account metadata, not a geotag.
  const fill = cluster.inferred
    ? `repeating-linear-gradient(45deg, ${withAlpha(color, 0.06)}, ${withAlpha(color, 0.06)} 4px, ` +
      `${withAlpha(color, 0.24)} 4px, ${withAlpha(color, 0.24)} 8px)`
    : withAlpha(color, isLight ? 0.18 : 0.24)

  const style = [
    `width:${size}px`,
    `height:${size}px`,
    'border-radius:50%',
    'box-sizing:border-box',
    'display:grid',
    'place-items:center',
    'font-weight:700',
    `font-size:${size <= SMALL_MARKER_SIZE ? 11 : 14}px`,
    `border:${cluster.stale ? 2 : 3}px ${cluster.inferred ? 'dashed' : 'solid'} ${color}`,
    `color:${color}`,
    `background:${fill}`,
    active ? `box-shadow:0 0 0 3px var(--c-ring),0 0 0 5px ${color}` : '',
    // Consumed by the `sentry-bloom` keyframes.
    `--bloom:${withAlpha(color, 0.5)}`,
  ]
    .filter(Boolean)
    .join(';')

  return L.divIcon({
    className: '',
    html: `<div class="${cluster.fresh ? 'sentry-bloom' : ''}" style="${style}">${cluster.count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

/** Side length of the aircraft arrowhead, in px. */
const AIRCRAFT_SIZE = 16

/**
 * An arrowhead oriented to a compass bearing.
 *
 * Leaflet rotates nothing for us, so the glyph is an inline SVG triangle with a
 * CSS rotation. `0°` points north, matching the `true_track` convention.
 */
function createAircraftIcon(point: MapPoint, bearingDeg: number, active: boolean): DivIcon {
  const color = layerColor(point.layerId)
  const size = AIRCRAFT_SIZE

  const glow = active ? `filter:drop-shadow(0 0 3px ${color});` : ''
  const svg =
    `<svg width="${size}" height="${size}" viewBox="0 0 16 16" style="display:block;${glow}">` +
    `<path d="M8 1 L13.5 14 L8 11 L2.5 14 Z" fill="${color}" stroke="${withAlpha('#ffffff', 0.85)}" stroke-width="1" stroke-linejoin="round"/>` +
    `</svg>`

  return L.divIcon({
    className: '',
    html: `<div style="transform:rotate(${bearingDeg}deg);transform-origin:50% 50%;">${svg}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

/** Point markers are dots, not counted circles — smallest to largest by severity. */
const POINT_SIZES = [9, 10, 12, 14, 17, 20]

const DEFAULT_SEVERITY = 2

/**
 * Build the `divIcon` for a signal-layer point.
 *
 * Visually subordinate to cluster markers by design: watches are the operator's
 * own subject, and context layers must not compete with them. Hence a plain dot
 * with a soft ring rather than a bordered, labelled circle.
 */
export function createPointIcon(point: MapPoint, { active }: { active: boolean }): DivIcon {
  const color = layerColor(point.layerId)
  const severity = Math.min(POINT_SIZES.length - 1, Math.max(0, Math.round(point.severity ?? DEFAULT_SEVERITY)))
  const size = POINT_SIZES[severity]

  // The monitored sites get a slow, wide halo so the eye lands on the subject
  // before it starts reading the context layers around it.
  const isSite = point.layerId === 'itr_sites'

  // A moving contact is drawn as an arrowhead pointing along its track. A dot
  // would throw away the two most useful things ADS-B reports: which way it is
  // going, and therefore whether it is routing around the range.
  if (point.layerId === 'itr_aircraft' && point.bearingDeg !== undefined) {
    return createAircraftIcon(point, point.bearingDeg, active)
  }

  const style = [
    `width:${size}px`,
    `height:${size}px`,
    'border-radius:50%',
    'box-sizing:border-box',
    `background:${color}`,
    `border:1.5px solid ${withAlpha(color, 0.9)}`,
    active ? `box-shadow:0 0 0 2px var(--c-ring),0 0 0 4px ${color}` : `box-shadow:0 0 0 3px ${withAlpha(color, 0.22)}`,
    // Consumed by the `sentry-ping` keyframes.
    isSite ? `--ping:${withAlpha(color, 0.45)}` : '',
  ]
    .filter(Boolean)
    .join(';')

  return L.divIcon({
    className: '',
    html: `<div class="${isSite ? 'sentry-ping' : ''}" style="${style}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}
