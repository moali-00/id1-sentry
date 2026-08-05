import { Legend } from '@/components/monitoring/Legend'
import { LayerRail } from '@/components/monitoring/LayerRail'
import type { Watch } from '@/types/monitoring'

interface LeftColumnProps {
  onCreate: () => void
  onEdit: (watch: Watch) => void
}

/**
 * The left edge of the map: the layer rail, with the legend pinned beneath it.
 *
 * These were positioned independently — the rail from the top, the legend from
 * the bottom — which meant a tall rail simply drew underneath the legend. One
 * bounded flex column makes the overlap impossible: the legend always keeps its
 * space, and the rail takes whatever is left and scrolls inside it.
 */
export function LeftColumn({ onCreate, onEdit }: LeftColumnProps) {
  return (
    // `justify-between` keeps the legend at the bottom edge where it has always
    // sat, while the rail shrinks from the top. With the column height bounded,
    // the two can no longer reach each other.
    <div className="pointer-events-none absolute top-4 bottom-4 left-4 flex flex-col items-start gap-2">
      <LayerRail onCreate={onCreate} onEdit={onEdit} />
      {/*
        `mt-auto` keeps the legend on the bottom edge while the rail shrinks from
        the top, so the two can never overlap.
       *
       * `max-h-[45%]` is the part that matters. Bounding the *column* was not
       * enough: the legend grows with the number of active layers, and at its
       * natural height it took the whole column — crushing the rail to its first
       * group header and still spilling past the bottom of the screen. Capped, the
       * rail always keeps the majority of the space and the legend scrolls, which
       * is the right way round because the rail is what you click.
       */}
      <div className="mt-auto flex min-h-0 max-h-[45%] flex-col">
        <Legend />
      </div>
    </div>
  )
}
