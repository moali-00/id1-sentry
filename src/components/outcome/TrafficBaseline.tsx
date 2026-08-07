import type { TrafficDay } from '@/utils/outcome'
import type { TrafficStats } from '@/types/outcome'

/**
 * Daily aircraft counts across the 34-day baseline, with the launch day marked.
 *
 * **Two charts, never two series on one axis.** Traffic outside the closure runs
 * about 1,599 aircraft a day and traffic inside it about 279. Sharing a y-axis
 * would press the inside series flat against the floor and invite the reader to
 * compare two slopes whose alignment is arbitrary — the single most misleading
 * thing a chart of this data could do. Each side gets its own panel, its own
 * scale, and its own stated mean.
 *
 * One hue. The launch day is the only mark that carries the accent; every
 * baseline day is drawn back to the muted track. That is the finding rendered
 * literally — if the closure had emptied the airspace, one column would be short
 * and it is not.
 *
 * The mean rule is a solid hairline rather than a dashed one: it is a reference
 * level that was actually measured, not a projection.
 */

/** Floor so a column is always a visible mark. Counts never reach zero here. */
const MIN_COLUMN_PCT = 4

export function TrafficBaseline({
  days,
  stats,
  label,
  caption,
}: {
  days: TrafficDay[]
  stats: TrafficStats
  label: string
  /** What this side of the boundary is, in a phrase. */
  caption: string
}) {
  const peak = Math.max(...days.map((day) => day.count), 1)
  const height = (count: number) => Math.max(MIN_COLUMN_PCT, (count / peak) * 100)

  return (
    <figure className="m-0 rounded-lg border border-line bg-inset p-2.5">
      <figcaption className="mb-2">
        <div className="flex items-baseline gap-2">
          <span className="label-micro text-fg-subtle">{label}</span>
          <span className="numeric ml-auto text-[10px] text-fg-subtle">
            mean {stats.mean} ± {stats.sd}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] leading-snug text-fg-subtle">{caption}</p>
      </figcaption>

      <div className="relative h-14">
        {/* The baseline mean, drawn behind the columns it describes. */}
        <span
          aria-hidden
          className="absolute inset-x-0 z-0 border-t border-line-soft"
          style={{ bottom: `${(stats.mean / peak) * 100}%` }}
        />

        {/* 2px of surface between adjacent columns, produced by the gap rather
            than by a stroke around each one. */}
        <ol className="relative z-10 flex h-full items-end gap-[2px]">
          {days.map((day) => (
            <li
              key={day.date}
              title={`${day.date} — ${day.count} aircraft${day.isLaunchDay ? ' (launch day)' : ''}`}
              className="group flex h-full flex-1 items-end"
            >
              <span
                className={
                  day.isLaunchDay
                    ? 'block w-full rounded-t-[3px] bg-accent'
                    : 'block w-full rounded-t-[3px] bg-meter-off transition-colors group-hover:bg-meter'
                }
                style={{ height: `${height(day.count)}%` }}
              />
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-1.5 flex items-baseline gap-2 border-t border-line-soft pt-1.5">
        <span aria-hidden className="size-1.5 rounded-[1px] bg-accent" />
        <span className="text-[10px] text-fg-muted">
          6 Aug · <span className="numeric font-bold text-fg">{stats.launch_day}</span>
        </span>
        <span className="numeric ml-auto text-[10px] text-fg-subtle">
          z = {stats.z > 0 ? '+' : ''}
          {stats.z.toFixed(2)}
        </span>
      </div>
    </figure>
  )
}
