import { layerColor } from '@/utils/layers'
import { withAlpha } from '@/utils/color'
import { CAMERA_SIZE } from '@/utils/markerGeometry'
import { getLiveMode } from '@/utils/cctv'
import type { Camera } from '@/types/cctv'

/**
 * A camera on the map.
 *
 * ## Why a lens glyph and not a dot
 *
 * Every context layer on this map is already a coloured dot, and a camera is not
 * context — it is something you click. A distinct silhouette says "this one opens"
 * without needing a legend entry to explain it, and it survives the case that
 * matters most: eighty cameras over central London, where circles merge into a blob
 * but a repeated recognisable shape still reads as "many cameras here".
 *
 * ## The delivery mode is drawn, not written
 *
 * The three modes differ in what you get by clicking, so the marker distinguishes
 * them before you do:
 *
 * - **video** — filled, with a live dot. Continuous stream.
 * - **snapshot** — outlined. A still on a timer, however short.
 * - **external** — outlined and dimmed. Opens the provider's page; no pixels here.
 *
 * That ordering is the same judgement as `scoreDelivery`: visual weight tracks how
 * much the camera actually gives you. A layer where all three looked alike would
 * promise live video eighty times and deliver it twice.
 */
export function CameraMarker({ camera, active, scale = 1 }: { camera: Camera; active: boolean; scale?: number }) {
  const color = layerColor('cctv')
  const mode = getLiveMode(camera)

  const size = Math.max(11, Math.round(CAMERA_SIZE * scale))
  const isVideo = mode === 'video'
  const isExternal = mode === 'external'

  return (
    <div
      style={{
        width: size,
        height: size,
        // A squared-off body with one rounded corner: a camera silhouette at 15px,
        // where a literal lens-and-housing drawing would be mud.
        borderRadius: '3px 3px 3px 50%',
        boxSizing: 'border-box',
        // The live pip below is absolutely positioned against this.
        position: 'relative',
        background: isVideo ? color : withAlpha(color, isExternal ? 0.12 : 0.28),
        border: `1.5px solid ${isExternal ? withAlpha(color, 0.55) : color}`,
        display: 'grid',
        placeItems: 'center',
        // Dimmed rather than hidden: an external camera is a real camera, it just
        // cannot be watched here.
        opacity: isExternal && !active ? 0.7 : 1,
        boxShadow: active
          ? `0 0 0 2px var(--c-ring), 0 0 0 4px ${color}`
          : `0 0 0 2.5px ${withAlpha(color, 0.18)}, 0 1px 2px rgba(0,0,0,.3)`,
        cursor: 'pointer',
        transition: 'opacity .12s ease',
      }}
    >
      {/*
        The lens. On a filled marker it has to be the hole, not another blob — so it
        takes the page background rather than white, which would read as a second
        colour on the satellite basemap.
      */}
      <div
        style={{
          width: Math.max(3, Math.round(size * 0.34)),
          height: Math.max(3, Math.round(size * 0.34)),
          borderRadius: '50%',
          background: isVideo ? 'var(--c-panel)' : withAlpha(color, 0.9),
        }}
      />

      {/*
        The live pip, on streaming cameras only.

        Positioned outside the body so it does not shrink the lens, and animated with
        the existing `animate-pulse-live` utility — which `prefers-reduced-motion`
        already disables, so this needs no separate handling.
      */}
      {isVideo && (
        <span
          className="animate-pulse-live"
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 5,
            height: 5,
            borderRadius: '50%',
            // The same green the status pill uses for a live feed, deliberately: a
            // streaming camera and a current backend mean the same thing here.
            background: 'var(--color-status-live)',
            outline: '1px solid var(--c-panel)',
          }}
        />
      )}
    </div>
  )
}
