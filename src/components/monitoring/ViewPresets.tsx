import { cn } from '@/utils/cn'
import { VIEW_PRESETS, type ViewPreset } from '@/utils/constants'
import { Panel } from '@/components/ui/Panel'

interface ViewPresetsProps {
  onSelect: (preset: ViewPreset) => void
}

/**
 * One-click theatre jumps.
 *
 * `hot` presets carry the same pulsing indicator the status pill uses for a
 * live feed — the visual grammar is "something is happening here", reused
 * rather than reinvented.
 */
export function ViewPresets({ onSelect }: ViewPresetsProps) {
  const hotCount = VIEW_PRESETS.filter((preset) => preset.hot).length

  return (
    <Panel className="w-[268px] p-2.5">
      <div className="mb-2 flex items-center justify-between px-0.5">
        <h2 className="text-[10px] font-bold tracking-[0.08em] text-title">JUMP TO</h2>
        <span className="text-[10px] font-semibold text-fg-subtle">
          {hotCount === 1 ? '1 active theatre' : `${hotCount} active theatres`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {VIEW_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => onSelect(preset)}
            className={cn(
              'flex items-center gap-1.5 rounded-md border border-line bg-control px-2.5 py-2 text-left text-xs font-semibold transition-colors',
              'hover:border-accent hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
              preset.hot ? 'text-cat-conflict' : 'text-fg',
            )}
          >
            {preset.hot && (
              <span aria-hidden className="size-1.5 flex-none animate-pulse-live rounded-full bg-cat-conflict" />
            )}
            <span className="truncate">{preset.label}</span>
          </button>
        ))}
      </div>
    </Panel>
  )
}
