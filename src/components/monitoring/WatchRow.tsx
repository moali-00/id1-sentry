import { Pencil } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Watch } from '@/types/monitoring'
import { CategorySwatch } from '@/components/ui/Badges'

interface WatchRowProps {
  watch: Watch
  enabled: boolean
  onToggle: () => void
  onEdit: () => void
}

/**
 * One layer in the watches rail: a click target that toggles map visibility,
 * plus an edit affordance that surfaces on hover or keyboard focus.
 */
export function WatchRow({ watch, enabled, onToggle, onEdit }: WatchRowProps) {
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

        <span className="text-xs font-bold text-fg-muted">{watch.count}</span>

        <span
          className={cn(
            'rounded-[10px] px-1.5 py-[2px] text-[8.5px] font-bold tracking-[0.05em] text-white',
            enabled ? 'bg-accent' : 'bg-off',
          )}
        >
          {enabled ? 'ON' : 'OFF'}
        </span>
      </button>

      <button
        type="button"
        onClick={onEdit}
        title={`Edit ${watch.name}`}
        aria-label={`Edit ${watch.name}`}
        className={cn(
          'mr-1.5 grid size-6 flex-none place-items-center rounded-md bg-control text-fg-muted',
          'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
          'hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        )}
      >
        <Pencil className="size-3" aria-hidden />
      </button>
    </div>
  )
}
