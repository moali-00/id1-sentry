import { useState } from 'react'
import { Marker } from 'react-map-gl/maplibre'
import { PointMarker } from '@/components/monitoring/markers/PointMarker'
import { FeatureTooltip, MapTooltip } from '@/components/monitoring/FeatureTooltip'
import { POINT_BASE_Z, scaleForZoom } from '@/utils/markerGeometry'
import { dataLayer, layerPriority } from '@/utils/layers'
import { relativeTime } from '@/utils/format'
import { useMapZoom } from '@/hooks/useMapZoom'
import type { MapPoint } from '@/types/monitoring'

/**
 * Signal-layer and ITR-feed points as DOM markers.
 *
 * DOM rather than a symbol layer, deliberately. The counts here are in the low
 * hundreds, so the cost is irrelevant, and the markers keep CSS animations
 * (`sentry-ping` on the monitored sites), a hatched gradient fill, and an SVG
 * arrowhead rotated to a compass bearing — none of which a sprite-based symbol
 * layer can do without pre-rendering an image per state.
 *
 * These carry no click behaviour: they are context, not subjects. Hovering
 * surfaces a tooltip and nothing more.
 *
 * Stacking is explicit. The subject of the dashboard must never be hidden behind
 * context, so the site markers sit above the warnings, which sit above the
 * thermal detections — the densest layer *and* the least significant.
 */

export function PointMarkers({ points }: { points: MapPoint[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const zoom = useMapZoom()
  const scale = scaleForZoom(zoom)

  const hovered = points.find((point) => point.id === hoveredId)

  return (
    <>
      {points.map((point) => (
        <Marker
          key={point.id}
          longitude={point.lng}
          latitude={point.lat}
          // A moving contact's arrowhead is aligned to the map so its heading
          // stays true when the camera is rotated; a dot has no orientation and
          // is unaffected either way.
          rotation={point.bearingDeg ?? 0}
          rotationAlignment="map"
          // Hidden rather than dimmed when it falls behind the globe or a ridge.
          // A half-visible marker on the far side of the Earth reads as a real
          // detection somewhere it is not.
          opacityWhenCovered="0"
          style={{ zIndex: POINT_BASE_Z + layerPriority(point.layerId) }}
        >
          <div
            onPointerEnter={() => setHoveredId(point.id)}
            onPointerLeave={() => setHoveredId((current) => (current === point.id ? null : current))}
          >
            <PointMarker point={point} active={point.id === hoveredId} scale={scale} />
          </div>
        </Marker>
      ))}

      {hovered && (
        <MapTooltip lat={hovered.lat} lng={hovered.lng}>
          <FeatureTooltip
            layerId={hovered.layerId}
            title={hovered.label}
            detail={hovered.detail}
            meta={metaLine(hovered)}
          />
        </MapTooltip>
      )}
    </>
  )
}

/** Provenance and age: which layer this came from, and how long ago. */
function metaLine(point: MapPoint): string {
  const layerLabel = dataLayer(point.layerId)?.label ?? point.layerId
  return point.timestamp === undefined ? layerLabel : `${layerLabel} · ${relativeTime(point.timestamp)}`
}
