import { cn } from '@/utils/cn'
import type { DataLayer } from '@/types/monitoring'

interface LayerRowProps {
  layer: DataLayer
  enabled: boolean
  /** Plotted feature count. Omitted for display layers, which plot nothing. */
  count?: number
  loading?: boolean
  onToggle: () => void
}

/**
 * One data layer in the rail — the non-watch counterpart to `WatchRow`.
 *
 * Deliberately the same silhouette as a watch row (swatch, name, count, ON/OFF)
 * so the rail reads as one list of layers rather than two unrelated widgets.
 */
export function LayerRow({ layer, enabled, count, loading = false, onToggle }: LayerRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={layer.hint}
      aria-pressed={enabled}
      className={cn(
        'flex w-full min-w-0 items-center gap-2.5 rounded-md py-2 pr-2 pl-2.5 text-left transition-colors',
        'hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        !enabled && 'opacity-50',
      )}
    >
      <span
        aria-hidden
        style={{ background: layer.color }}
        className={cn('size-3 flex-none rounded-[3px]', loading && 'animate-pulse')}
      />

      <span className={cn('flex-1 truncate text-[13px] text-fg', !enabled && 'line-through')}>{layer.label}</span>

      {count !== undefined && enabled && (
        <span className="font-mono text-[11px] font-bold text-fg-muted tabular-nums">{count}</span>
      )}

      <span
        className={cn(
          'rounded-[10px] px-1.5 py-[2px] text-[8.5px] font-bold tracking-[0.05em] text-white',
          enabled ? 'bg-accent' : 'bg-off',
        )}
      >
        {enabled ? 'ON' : 'OFF'}
      </span>
    </button>
  )
}
