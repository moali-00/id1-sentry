import { dataLayer } from '@/utils/layers'
import type { DataLayerId } from '@/types/monitoring'

/**
 * One tooltip format for every feature on the map.
 *
 * Leaflet tooltips take an HTML string, so this is the single place that
 * composes and escapes it — points, areas and lines all go through here rather
 * than each assembling their own markup.
 *
 * The last line is the important one. A wedge, a dashed box and a coloured dot
 * mean nothing on their own, and an operator who has not read the code has no
 * way to learn what a shape is asserting. Every feature therefore carries a
 * plain-English note explaining what it depicts and how far to trust it.
 */

export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  )
}

export interface TooltipParts {
  /** The feature's own identity — a warning number, a callsign, a place. */
  title: string
  /** Its measured values — bearing, range, altitude, brightness. */
  detail?: string
  /** Provenance and age — which layer, how long ago. */
  meta?: string
  /** What this kind of feature means. Defaults to the layer's own note. */
  meaning?: string
}

export function buildTooltip(layerId: DataLayerId, { title, detail, meta, meaning }: TooltipParts): string {
  const note = meaning ?? dataLayer(layerId)?.explain ?? dataLayer(layerId)?.hint

  return [
    `<span style="font-weight:700">${escapeHtml(title)}</span>`,
    detail ? `<br><span style="opacity:.85">${escapeHtml(detail)}</span>` : '',
    meta ? `<br><span style="opacity:.6;font-size:10px">${escapeHtml(meta)}</span>` : '',
    // No width here — the tooltip element owns its own sizing. A `max-width` on
    // this inner block used to fight the container's.
    note
      ? `<span style="display:block;margin-top:5px;padding-top:5px;border-top:1px solid var(--c-line-soft);` +
        `opacity:.75;font-size:10px;font-style:italic;line-height:1.4">` +
        `${escapeHtml(note)}</span>`
      : '',
  ].join('')
}
