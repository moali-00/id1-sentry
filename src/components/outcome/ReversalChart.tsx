import type { ReversalRow } from '@/utils/outcome'

/**
 * How often each system was named, before the trial and after it.
 *
 * **Why this is an emphasis chart and not two categorical series.** The two bars
 * are not two things being compared on equal terms — one is speculation and the
 * other is the record, and the finding is that the first was inversely related
 * to the truth. So "after" carries the accent and "before" is a recessive track
 * behind it. A two-hue categorical palette would give equal visual weight to a
 * corpus that was wrong, and the obvious neutral pair for it (slate against the
 * accent blue) fails the adjacent-separation check anyway at ΔE 11.8.
 *
 * Both bars are directly labelled, so identity never rests on colour alone and
 * every value in the chart is legible without hovering — which is also the
 * relief the contrast check requires for the muted track.
 *
 * One shared scale across both bars and every row. Scaling each row to its own
 * maximum would make Agni-VI's collapse from 21 to 2 look identical to Agni-IV's
 * rise from 3 to 58.
 */

/** Minimum drawn width, so a count of 1 is still a visible mark rather than nothing. */
const MIN_BAR_PCT = 1.5

function DeltaChip({ delta }: { delta: number }) {
  if (delta === 0) return <span className="numeric text-[9.5px] text-fg-subtle">—</span>

  // Direction is carried by the arrow and the sign, not by colour. A rise in
  // mentions is neither good nor bad, and painting it with a status hue would
  // claim it was one.
  return (
    <span className="numeric text-[9.5px] text-fg-muted">
      {delta > 0 ? '▲' : '▼'}
      {Math.abs(delta)}
    </span>
  )
}

export function ReversalChart({ rows }: { rows: ReversalRow[] }) {
  const peak = Math.max(...rows.map((row) => Math.max(row.before, row.after)), 1)
  const width = (count: number) => (count === 0 ? 0 : Math.max(MIN_BAR_PCT, (count / peak) * 100))

  return (
    <figure className="m-0">
      {/* The legend is present because there are two marks, and it is above the
          plot rather than beside it — these rows are narrow, and a right-hand
          legend would cost the bars a third of their length. */}
      <figcaption className="mb-2 flex items-center gap-3 text-[9.5px] text-fg-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-1 w-4 rounded-full bg-meter-off" />
          Before · speculation
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-1 w-4 rounded-full bg-accent" />
          After · the record
        </span>
      </figcaption>

      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.system}
            // The whole row is the hit target, which is comfortably past the 24px
            // minimum — the bars themselves are 4px tall.
            title={`${row.system} — named ${row.before} times before the trial, ${row.after} after`}
            className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-hover"
          >
            <span className="truncate text-[10.5px] font-semibold text-fg">{row.system}</span>

            {/* 3px of surface between the two tracks — a gap, not a border. */}
            <span className="flex flex-col gap-[3px]">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="h-1 flex-1 overflow-hidden rounded-full">
                  <span className="block h-full rounded-full bg-meter-off" style={{ width: `${width(row.before)}%` }} />
                </span>
                <span className="numeric w-5 text-right text-[9.5px] text-fg-subtle">{row.before}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="h-1 flex-1 overflow-hidden rounded-full">
                  <span
                    className="block h-full rounded-full bg-accent transition-[width] duration-700"
                    style={{ width: `${width(row.after)}%` }}
                  />
                </span>
                <span className="numeric w-5 text-right text-[9.5px] font-bold text-fg">{row.after}</span>
              </span>
            </span>

            <DeltaChip delta={row.delta} />
          </li>
        ))}
      </ul>
    </figure>
  )
}
