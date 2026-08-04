/**
 * Pixel geometry shared between a marker's own markup and the `<Marker>` that
 * positions it.
 *
 * Split out because MapLibre places the marker container and the component draws
 * inside it — the anchor offset and the element height have to agree, and they
 * are set in two different files.
 */

/** Point markers are dots, not counted circles — smallest to largest by severity. */
export const POINT_SIZES = [9, 10, 12, 14, 17, 20]

export const DEFAULT_SEVERITY = 2

/** Side length of the aircraft arrowhead, in px. */
export const AIRCRAFT_SIZE = 16

/** Marker scale by zoom. Below `MIN_ZOOM_FOR_FULL` they shrink toward `MIN_SCALE`. */
const MIN_SCALE = 0.55
const MIN_ZOOM_FOR_FULL = 8

/**
 * How large a marker draws at this zoom.
 *
 * Linear from `MIN_SCALE` at z2 to full size at z8 — gentle enough that a marker
 * never appears to jump between levels. At world view they stay small dots that
 * do not merge into a blob, and grow to full size as you close in.
 */
export function scaleForZoom(zoom: number): number {
  if (zoom >= MIN_ZOOM_FOR_FULL) return 1
  const t = Math.max(0, Math.min(1, (zoom - 2) / (MIN_ZOOM_FOR_FULL - 2)))
  return MIN_SCALE + (1 - MIN_SCALE) * t
}

/** Height of a reporting pill, in px. Width follows the digit count. */
export const REPORTING_HEIGHT = 18

/**
 * How far the reporting pill sits up and to the right of the site it annotates.
 *
 * Applied as the `<Marker>` offset against a `bottom-left` anchor, which puts the
 * pill's lower-left corner just clear of the site marker rather than on top of it.
 */
export const REPORTING_OFFSET: [number, number] = [8, -8]

/** Below this diameter a cluster's count label needs a smaller type size to fit. */
export const SMALL_MARKER_SIZE = 28

/* ── Marker stacking ─────────────────────────────────────────────────────────
 *
 * **Every one of these must stay positive.**
 *
 * A MapLibre marker is a plain DOM element sitting beside the map canvas in the
 * same stacking context, and `<Marker style={{ zIndex }}>` writes a raw CSS
 * z-index onto it. A negative value therefore paints the marker *behind the
 * canvas*, which is opaque wherever a tile has drawn — the marker vanishes
 * completely, halo animation included, with nothing in the DOM to suggest why.
 *
 * Leaflet's `zIndexOffset` looked like the same thing and was not: it was applied
 * inside Leaflet's own marker pane, which carried its own positive base, so
 * negative offsets were merely relative and stayed above the tiles. Porting those
 * numbers across verbatim is what made every marker disappear.
 *
 * The order below is the one the dashboard needs: the subject of the map is never
 * hidden behind context.
 */

/**
 * Reporting pills sit under everything.
 *
 * A count *about* a place must not cover the place, or the warnings and
 * evacuation markers around it.
 */
export const REPORTING_Z = 1

/**
 * Base for point markers; `layerPriority()` (0–400) is added to it.
 *
 * Leaves headroom above the reporting pills and stays clear of the clusters.
 */
export const POINT_BASE_Z = 101

/** Watch clusters — the operator's own subject, above every context layer. */
export const CLUSTER_Z = 601

/** A hovered cluster lifts clear of its neighbours, as `riseOnHover` did. */
export const CLUSTER_HOVER_Z = 701
