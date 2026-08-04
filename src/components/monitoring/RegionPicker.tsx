import { Eraser, MapPin, Pencil } from 'lucide-react'
import { CATEGORIES } from '@/utils/constants'
import { withAlpha } from '@/utils/color'

const REGION_HUE = CATEGORIES.infra.color

interface RegionPickerProps {
  /** Whether an area has been drawn. */
  hasRegion: boolean
  onChange: (hasRegion: boolean) => void
}

/**
 * Region-drawing surface for the watch form.
 *
 * A schematic stand-in rather than a live map instance: the modal sits over the
 * real map, and mounting a second GL context purely to draw a rectangle costs
 * considerably more than it returns. Swapping in a real draw surface — `terra-draw`
 * or `mapbox-gl-draw`, both of which speak MapLibre — only touches this file.
 */
export function RegionPicker({ hasRegion, onChange }: RegionPickerProps) {
  return (
    <div className="relative h-[190px] overflow-hidden rounded-xl border border-line bg-sea">
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'linear-gradient(var(--c-line) 1px, transparent 1px), linear-gradient(90deg, var(--c-line) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <svg viewBox="0 0 600 190" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <ellipse
          cx="185"
          cy="98"
          rx="150"
          ry="48"
          className="fill-fg-subtle/20 stroke-fg-subtle"
          strokeWidth="2"
          strokeDasharray="6 5"
        />
        <ellipse
          cx="415"
          cy="92"
          rx="105"
          ry="44"
          className="fill-fg-subtle/20 stroke-fg-subtle"
          strokeWidth="2"
          strokeDasharray="6 5"
        />
        {hasRegion && (
          <rect
            x="240"
            y="66"
            width="150"
            height="86"
            rx="4"
            fill={withAlpha(REGION_HUE, 0.18)}
            stroke={REGION_HUE}
            strokeWidth="2.5"
            strokeDasharray="7 5"
          />
        )}
      </svg>

      <p className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-1 text-[10px] text-fg-muted backdrop-blur-sm">
        <MapPin className="size-3" style={{ color: REGION_HUE }} aria-hidden />
        Click-drag on the map to draw a region
      </p>

      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(true)}
          className="flex items-center gap-1 rounded-md border border-line bg-panel px-2 py-1 text-[10px] font-semibold text-fg backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          <Pencil className="size-3" aria-hidden /> Draw
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className="flex items-center gap-1 rounded-md border border-line bg-panel px-2 py-1 text-[10px] font-semibold text-fg-muted backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          <Eraser className="size-3" aria-hidden /> Clear
        </button>
      </div>
    </div>
  )
}
