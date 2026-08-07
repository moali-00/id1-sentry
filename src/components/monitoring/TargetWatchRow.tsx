import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import { LEVEL_COLOR } from '@/utils/levels'
import { layersInGroup } from '@/utils/layers'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { selectTargetSummary } from '@/store/slices/itrSlice'
import { selectLayerEnabled, setGroupEnabled } from '@/store/slices/layersSlice'
import { Toggle } from '@/components/ui/Toggle'

/**
 * The ITR target, presented in the rail exactly like a watch.
 *
 * Deliberately the same silhouette as `WatchRow` — swatch, name, count, report
 * switch, ON/OFF — because to an operator it *is* the thing being watched. The
 * differences are that its swatch colour comes from the live assessment level
 * rather than a fixed category, that its toggle drives the whole `itr_feeds`
 * group rather than one layer, and that it reports by default.
 *
 * The ON/OFF pill sits outside the row button for the same reason it does in
 * `WatchRow` — a button cannot nest inside a button, and the report switch has
 * to fall ahead of the pill. See that file for the full note.
 */
export function TargetWatchRow() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const target = useAppSelector(selectTargetSummary)
  const layerEnabled = useAppSelector(selectLayerEnabled)

  /**
   * On, where an operator's own watches start off.
   *
   * This target is the dashboard's standing subject rather than something drawn
   * on the map in passing: it is configured server-side, it is what the
   * assessment and the after-action review are both about, and a deployment that
   * reports on nothing by default would be reporting on the one thing it exists
   * to watch. Local state, like the watch rows — nothing consumes it yet.
   */
  const [reporting, setReporting] = useState(true)

  const feeds = layersInGroup('itr_feeds')
  const activeFeeds = feeds.filter((layer) => layerEnabled[layer.id]).length
  const enabled = activeFeeds > 0
  const color = target.level ? LEVEL_COLOR[target.level] : 'var(--c-off)'

  return (
    <div
      className={cn('group flex items-center rounded-md transition-colors hover:bg-hover', !enabled && 'opacity-50')}
    >
      <button
        type="button"
        onClick={() => dispatch(setGroupEnabled({ groupKey: 'itr_feeds', enabled: !enabled }))}
        aria-pressed={enabled}
        title={enabled ? 'Hide this target’s feeds' : 'Show this target’s feeds'}
        className="flex min-w-0 flex-1 items-center gap-2.5 py-2 pr-1.5 pl-2.5 text-left focus-visible:outline-none"
      >
        <span
          aria-hidden
          style={{ background: color }}
          className={cn('size-3 flex-none rounded-[3px]', target.loading && 'animate-pulse')}
        />

        <span className={cn('flex-1 truncate text-[13px] text-fg', !enabled && 'line-through')}>{target.name}</span>

        <span className="numeric text-xs font-bold text-fg-muted">{target.featureCount}</span>
      </button>

      <Toggle
        size="sm"
        checked={reporting}
        onChange={setReporting}
        label={`Send reports for ${target.name}`}
        title={reporting ? 'Reporting on — a report is sent' : 'Reporting off — no report is sent'}
        className="mr-2 ml-2"
      />

      <button
        type="button"
        onClick={() => dispatch(setGroupEnabled({ groupKey: 'itr_feeds', enabled: !enabled }))}
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
        onClick={() => void navigate('/target')}
        title={`Open ${target.name} dossier`}
        aria-label={`Open ${target.name} dossier`}
        className={cn(
          'mr-1.5 ml-1.5 grid size-6 flex-none place-items-center rounded-md bg-control text-fg-muted',
          'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
          'hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        )}
      >
        <ChevronRight className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}
