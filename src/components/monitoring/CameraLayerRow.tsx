import { useMapController } from '@/components/monitoring/MapContext'
import { isUsingCameraFixture } from '@/api/cctv'
import { LayerRow } from '@/components/monitoring/LayerRow'
import { useAppDispatch, useAppSelector } from '@/store/store'
import {
  selectCameraCounts,
  selectCameraFailures,
  selectCameraStatus,
} from '@/store/slices/camerasSlice'
import { selectLayerEnabled, toggleLayer } from '@/store/slices/layersSlice'
import { dataLayer } from '@/utils/layers'
import { CAMERA_PLACES } from '@/utils/constants'

/**
 * The camera layer's rail row, plus the two things a plain `LayerRow` cannot say.
 *
 * **What you are getting.** "412 cameras" sounds like 412 live feeds. Over London it
 * is 412 stills on a 60-second timer, and that difference decides whether the layer
 * is worth opening — so the counts are stated, in one line.
 *
 * **Where to find one.** The subject of this dashboard is the Odisha coast, which has
 * no open cameras at all. An operator who switches this layer on where they normally
 * work sees an empty map, correctly — and with nowhere to go, correct and broken look
 * identical.
 *
 * There is deliberately **no delivery-mode filter**. It existed, offering
 * All / Video / Stills, and it was a control for a problem nobody had: the layer
 * draws everything it holds, the marker already shows which kind each camera is, and
 * a segmented control that starts on "all" and is rarely moved is three buttons of
 * chrome earning nothing.
 */
export function CameraLayerRow() {
  const dispatch = useAppDispatch()
  const { flyTo } = useMapController()
  const enabled = useAppSelector(selectLayerEnabled).cctv
  const status = useAppSelector(selectCameraStatus)
  const counts = useAppSelector(selectCameraCounts)
  const failures = useAppSelector(selectCameraFailures)

  const layer = dataLayer('cctv')
  if (!layer) return null

  return (
    <>
      <LayerRow
        layer={layer}
        enabled={enabled}
        // What is in frame, the same way a signal layer's point count is.
        count={enabled ? counts.all : undefined}
        loading={enabled && status === 'loading'}
        onToggle={() => dispatch(toggleLayer('cctv'))}
      />

      {enabled && (
        <div className="mt-1 flex flex-col gap-2 px-1 pb-1">
          {counts.all > 0 && (
            <p className="text-[10.5px] text-fg-muted">
              <span className="numeric font-semibold text-fg">{counts.nearLive}</span> stills ·{' '}
              <span className="numeric font-semibold text-fg">{counts.live}</span> video
            </p>
          )}

          {counts.all === 0 && status !== 'loading' && (
            <p className="text-[10.5px] leading-relaxed text-fg-muted">
              No open cameras in this view — most of the world has none, including this
              coast.
            </p>
          )}

          {/* A named blind spot, not an empty area. The `error` vs `empty` distinction. */}
          {failures.length > 0 && (
            <p className="text-[10.5px] leading-relaxed text-status-inferred">
              {failures.join(', ')} not answering — cameras there are missing, not absent.
            </p>
          )}

          {/*
            Only true on a host with no functions (`vite preview`, a plain bucket).
            Worth stating: markers appear and pictures do not, which otherwise looks
            like every camera being down at once.
          */}
          {isUsingCameraFixture() && (
            <p className="text-[10.5px] leading-relaxed text-fg-subtle">
              Bundled sample — no camera proxy on this host, so frames will not load.
            </p>
          )}

          <div>
            <p className="mb-1 label-micro text-fg-subtle">JUMP TO</p>
            <div className="flex flex-col gap-0.5">
              {CAMERA_PLACES.map((place) => (
                <button
                  key={place.key}
                  type="button"
                  onClick={() => flyTo(place.lat, place.lng, { zoom: place.zoom })}
                  className="flex items-baseline gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                >
                  <span className="flex-1 truncate text-[11.5px] text-fg">{place.label}</span>
                  <span className="text-[10px] text-fg-subtle">{place.detail}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
