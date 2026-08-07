import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Watch } from '@/types/monitoring'
import { CategorySwatch } from '@/components/ui/Badges'
import { Toggle } from '@/components/ui/Toggle'

interface WatchRowProps {
  watch: Watch
  enabled: boolean
  onToggle: () => void
  onEdit: () => void
}

/**
 * One layer in the watches rail: a click target that toggles map visibility, a
 * switch for whether the watch reports, plus an edit affordance that surfaces on
 * hover or keyboard focus.
 *
 * **The ON/OFF pill is a sibling of the row button rather than inside it.** It
 * has to be, now that the report switch sits ahead of it — a `<button>` cannot
 * contain another `<button>`, and the switch has to fall between the count and
 * the pill. Lifting the pill out and giving it its own click handler keeps the
 * hit area exactly where it was: pressing the pill still toggles visibility.
 * It is hidden from assistive technology and skipped by the tab order, because
 * the row button beside it already carries the same action and `aria-pressed`,
 * and announcing the control twice is worse than not announcing the decoration.
 */
export function WatchRow({ watch, enabled, onToggle, onEdit }: WatchRowProps) {
  /**
   * Whether this watch sends a report.
   *
   * Off by default, unlike the ITR target's row. Reporting is an action taken on
   * the operator's behalf, and the safe default for an action is not to take it —
   * a watch created from a keyword should not start mailing out reports because
   * nobody thought to look at this switch. The target is the deliberate exception:
   * it is the standing subject of the dashboard, and it is configured, not drawn.
   *
   * Local state on purpose. Nothing consumes it yet — there is no reporting
   * pipeline behind it — and putting it in `monitoringSlice` would make the
   * store assert a setting the app does not act on. The switch is honest as an
   * affordance; lift it into the slice at the point a report is actually sent.
   */
  const [reporting, setReporting] = useState(false)

  return (
    <div
      className={cn('group flex items-center rounded-md transition-colors hover:bg-hover', !enabled && 'opacity-50')}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        className="flex min-w-0 flex-1 items-center gap-2.5 py-2 pr-1.5 pl-2.5 text-left focus-visible:outline-none"
      >
        <CategorySwatch category={watch.category} />

        <span className={cn('flex-1 truncate text-[13px] text-fg', !enabled && 'line-through')}>{watch.name}</span>

        <span className="numeric text-xs font-bold text-fg-muted">{watch.count}</span>
      </button>

      <Toggle
        size="sm"
        checked={reporting}
        onChange={setReporting}
        label={`Send reports for ${watch.name}`}
        title={reporting ? 'Reporting on — a report is sent' : 'Reporting off — no report is sent'}
        className="mr-2 ml-2"
      />

      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        aria-hidden
        className={cn(
          'flex-none rounded-[10px] px-1.5 py-[2px] text-[8.5px] font-bold tracking-[0.05em]',
          enabled ? 'bg-accent text-accent-fg' : 'bg-off text-white',
        )}
      >
        {enabled ? 'ON' : 'OFF'}
      </button>

      <button
        type="button"
        onClick={onEdit}
        title={`Edit ${watch.name}`}
        aria-label={`Edit ${watch.name}`}
        className={cn(
          'mr-1.5 ml-1.5 grid size-6 flex-none place-items-center rounded-md bg-control text-fg-muted',
          'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
          'hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        )}
      >
        <Pencil className="size-3" aria-hidden />
      </button>
    </div>
  )
}
