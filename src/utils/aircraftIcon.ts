import { BAND_COLOR, type AltitudeBand } from '@/utils/flights'

/**
 * The aircraft marker, drawn to a canvas so MapLibre can rotate it.
 *
 * Rasterised at runtime rather than shipped as a sprite because there is one
 * variant per altitude band and the colours come from the design tokens — a sprite
 * would freeze them into an asset and drift the moment the palette moves.
 *
 * Icons rather than DOM markers because these rotate and move every frame. A
 * symbol layer hands that to the GPU; thirty `<div>`s with CSS transforms hand it
 * to the compositor and the main thread.
 */

/** Design-space box. Coordinates below are authored against this. */
const BOX = 32

/**
 * Top-down airliner, nose at north.
 *
 * Symmetric about x=16 so rotation reads true, and authored as a silhouette
 * rather than an arrow: a wing-and-tailplane shape tells you at a glance that the
 * thing is an aircraft and which way it is pointing, where a triangle only does
 * the second.
 *
 * MapLibre's `icon-rotate` is clockwise from north, which is exactly what `track`
 * reports — so no conversion anywhere.
 */
const OUTLINE: readonly [number, number][] = [
  [16, 0.5], // nose
  [17.6, 3.4],
  [17.6, 12], // fuselage, right shoulder
  [31, 20], // right wingtip, leading
  [31, 23.2], // right wingtip, trailing
  [17.6, 19.2], // wing root, trailing
  [17.6, 26], // rear fuselage
  [21.6, 29], // right tailplane
  [21.6, 31],
  [16, 29.4], // tail centre
  [10.4, 31],
  [10.4, 29],
  [14.4, 26],
  [14.4, 19.2],
  [1, 23.2], // left wingtip, trailing
  [1, 20], // left wingtip, leading
  [14.4, 12],
  [14.4, 3.4],
]

/**
 * Dark keyline under the fill.
 *
 * The same icon has to stay legible over a near-black dark basemap, a pale light
 * one and satellite imagery. A coloured shape alone disappears against at least
 * one of those; an outline in the root background colour separates it from all
 * three without introducing a fourth colour.
 */
const KEYLINE = 'rgba(13, 17, 23, 0.9)'

/**
 * Render one band's icon.
 *
 * Returns `null` when a 2D context is unavailable — headless and some hardened
 * browser configurations refuse one, and the caller falls back to plain dots
 * rather than crashing the map.
 */
export function aircraftIconImage(band: AltitudeBand, pixelRatio = 2): ImageData | null {
  const size = BOX * pixelRatio

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.scale(pixelRatio, pixelRatio)

  ctx.beginPath()
  ctx.moveTo(OUTLINE[0][0], OUTLINE[0][1])
  for (const [x, y] of OUTLINE.slice(1)) ctx.lineTo(x, y)
  ctx.closePath()

  ctx.fillStyle = BAND_COLOR[band]
  ctx.fill()

  ctx.lineWidth = 1.2
  ctx.lineJoin = 'round'
  ctx.strokeStyle = KEYLINE
  ctx.stroke()

  return ctx.getImageData(0, 0, size, size)
}

/** Image id for a band, shared by the registrar and the layer's paint expression. */
export const aircraftIconId = (band: AltitudeBand): string => `aircraft-${band}`

/** What the symbol layer scales an icon by — the design box is deliberately large. */
export const AIRCRAFT_ICON_SCALE = 0.62
