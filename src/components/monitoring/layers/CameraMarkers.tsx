import { useCallback, useState } from 'react'
import { Marker } from 'react-map-gl/maplibre'
import { useNavigate } from 'react-router-dom'
import { CameraMarker } from '@/components/monitoring/markers/CameraMarker'
import { MapTooltip } from '@/components/monitoring/FeatureTooltip'
import { CAMERA_HOVER_Z, CAMERA_Z, scaleForZoom } from '@/utils/markerGeometry'
import { getLiveMode, inferRefreshIntervalSeconds } from '@/utils/cctv'
import { useMapZoom } from '@/hooks/useMapZoom'
import type { Camera } from '@/types/cctv'

/**
 * Open-source cameras as DOM markers.
 *
 * DOM for the same reasons the other markers are, plus one specific to this layer:
 * these are the only markers on the map that are **clickable**. Every other marker
 * is a plotted observation that offers a tooltip and nothing more — `PointMarkers`
 * says so explicitly. A camera opens a viewer, so it needs a real element with a
 * cursor, a hit area and keyboard focus, none of which a sprite in a symbol layer
 * has.
 *
 * Clicking routes to `/camera/:id` rather than setting component state, following
 * the same rule as the watch and site panels: a link opens straight into a camera
 * and Back closes it.
 */

export function CameraMarkers({ cameras }: { cameras: Camera[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const navigate = useNavigate()
  const zoom = useMapZoom()
  const scale = scaleForZoom(zoom)

  const hovered = cameras.find((camera) => camera.id === hoveredId)

  const open = useCallback(
    (camera: Camera) => {
      void navigate(`/camera/${encodeURIComponent(camera.id)}`)
    },
    [navigate],
  )

  return (
    <>
      {cameras.map((camera) => (
        <Marker
          key={camera.id}
          longitude={camera.lng}
          latitude={camera.lat}
          // Hidden rather than dimmed behind the globe or a ridge. A half-visible
          // camera on the far side of the Earth reads as one you could open.
          opacityWhenCovered="0"
          style={{ zIndex: camera.id === hoveredId ? CAMERA_HOVER_Z : CAMERA_Z }}
          onClick={() => open(camera)}
        >
          <div
            // A button, not a bare div: this is the only interactive marker on the
            // map, and it should be reachable and activatable from the keyboard like
            // any other control in the chrome.
            role="button"
            tabIndex={0}
            aria-label={`Open camera: ${camera.name}`}
            onPointerEnter={() => setHoveredId(camera.id)}
            onPointerLeave={() => setHoveredId((current) => (current === camera.id ? null : current))}
            onFocus={() => setHoveredId(camera.id)}
            onBlur={() => setHoveredId((current) => (current === camera.id ? null : current))}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              // Space would otherwise scroll the page under the map.
              event.preventDefault()
              open(camera)
            }}
          >
            <CameraMarker camera={camera} active={camera.id === hoveredId} scale={scale} />
          </div>
        </Marker>
      ))}

      {/*
        Two lines, and no more.

        This used to render the full `FeatureTooltip` — name, place, delivery,
        provider, and the layer's whole explanatory paragraph — which is right for a
        danger area you can only hover, and wrong here. A camera is a *control*: the
        hover only has to identify it well enough to decide whether to click, and the
        panel behind the click already carries the provenance, the cadence, the
        coordinates and the caveats. Repeating them on the map is noise over eighty
        overlapping markers.
      */}
      {hovered && (
        <MapTooltip lat={hovered.lat} lng={hovered.lng}>
          <span className="font-bold">{hovered.name}</span>
          <br />
          <span className="text-[10px] opacity-70">{deliveryLine(hovered)}</span>
        </MapTooltip>
      )}
    </>
  )
}

/**
 * What clicking gets you, in three words.
 *
 * The cadence is the one number worth carrying onto the map: "60s stills" and "live
 * video" are different kinds of evidence, and the marker's shape alone cannot say
 * which interval a still is on.
 */
function deliveryLine(camera: Camera): string {
  const mode = getLiveMode(camera)
  if (mode === 'video') return 'Live video'
  if (mode === 'external') return 'Opens at provider'
  return `${inferRefreshIntervalSeconds(camera)}s stills`
}
