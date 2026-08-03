import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react'
import { cn } from '@/utils/cn'

interface LayerGroupSectionProps {
  label: string
  /** How many layers in this group are switched on. */
  activeCount: number
  totalCount: number
  expanded: boolean
  onToggleExpanded: () => void
  /** Switch every layer in the group on, or all off if any are on. */
  onToggleAll: () => void
  children: ReactNode
}

/**
 * One collapsible group in the layer rail.
 *
 * The header is two separate controls rather than one: the title expands the
 * group, the toggle on the right switches every layer in it. Conflating them
 * would make it impossible to see a group's contents without turning them on.
 */
export function LayerGroupSection({
  label,
  activeCount,
  totalCount,
  expanded,
  onToggleExpanded,
  onToggleAll,
  children,
}: LayerGroupSectionProps) {
  const allOn = activeCount > 0 && activeCount === totalCount
  const anyOn = activeCount > 0
  const Chevron = expanded ? ChevronDown : ChevronRight
  const Toggle = anyOn ? ToggleRight : ToggleLeft

  return (
    <section className="border-b border-line-soft last:border-b-0">
      <div className="flex items-center gap-1 px-2 py-2">
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left transition-colors',
            'hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
          )}
        >
          <Chevron className="size-3.5 flex-none text-fg-subtle" aria-hidden />
          <span className="flex-1 truncate text-[10px] font-bold tracking-[0.08em] text-title">{label}</span>
          <span
            className={cn('font-mono text-[10px] tabular-nums', anyOn ? 'font-semibold text-accent' : 'text-fg-subtle')}
          >
            {activeCount}/{totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleAll}
          title={allOn ? `Turn off all ${label}` : `Turn on all ${label}`}
          aria-label={allOn ? `Turn off all ${label}` : `Turn on all ${label}`}
          aria-pressed={anyOn}
          className={cn(
            'grid size-6 flex-none place-items-center rounded-md transition-colors',
            'hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
            anyOn ? 'text-accent' : 'text-fg-subtle',
          )}
        >
          <Toggle className="size-4" aria-hidden />
        </button>
      </div>

      {expanded && <div className="flex flex-col gap-0.5 px-1.5 pb-2">{children}</div>}
    </section>
  )
}
