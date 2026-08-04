import { Popup } from 'react-map-gl/maplibre'
import { dataLayer } from '@/utils/layers'
import type { DataLayerId } from '@/types/monitoring'

/**
 * One tooltip format for every feature on the map.
 *
 * Points, areas and lines all render through here rather than each assembling
 * their own markup. The four parts are ordered as an analyst reads them:
 * identity, then measurements, then provenance, then meaning.
 *
 * The last line is the important one. A wedge, a dashed box and a coloured dot
 * mean nothing on their own, and an operator who has not read the code has no way
 * to learn what a shape is asserting. Every feature therefore carries a
 * plain-English note explaining what it depicts and how far to trust it.
 *
 * This used to be a hand-escaped HTML string, because Leaflet tooltips took one.
 * MapLibre popups take a DOM node, so the text is now interpolated as JSX and
 * React does the escaping — which matters, since every field here is prose that
 * arrived from a backend feed.
 */

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

export function FeatureTooltip({ layerId, title, detail, meta, meaning }: TooltipParts & { layerId: DataLayerId }) {
  const layer = dataLayer(layerId)
  const note = meaning ?? layer?.explain ?? layer?.hint

  return (
    <>
      <span className="font-bold">{title}</span>
      {detail && (
        <>
          <br />
          <span className="opacity-85">{detail}</span>
        </>
      )}
      {meta && (
        <>
          <br />
          <span className="text-[10px] opacity-60">{meta}</span>
        </>
      )}
      {note && (
        <span className="mt-[5px] block border-t border-line-soft pt-[5px] text-[10px] leading-[1.4] italic opacity-75">
          {note}
        </span>
      )}
    </>
  )
}

/**
 * The popup a hovered feature shows.
 *
 * `closeButton` and `closeOnClick` are both off: this follows the pointer and is
 * dismissed by moving away, so a chrome affordance to close it would be a
 * control that does nothing the mouse has not already done. The `map-tooltip`
 * class also turns off pointer events — a popup under the cursor would otherwise
 * trigger the feature's own mouse-out and flicker.
 */
export function MapTooltip({ lat, lng, children }: { lat: number; lng: number; children: React.ReactNode }) {
  return (
    <Popup
      latitude={lat}
      longitude={lng}
      closeButton={false}
      closeOnClick={false}
      offset={10}
      maxWidth="280px"
      className="map-tooltip"
    >
      {children}
    </Popup>
  )
}
