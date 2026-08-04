import { cn } from '@/utils/cn'
import { VIEW_PRESETS, type ViewPreset } from '@/utils/constants'
import { Panel, PanelHeader, PanelTitle } from '@/components/ui/Panel'

interface ViewPresetsProps {
  onSelect: (preset: ViewPreset) => void
}

const NO_FEED_HINT = 'No feed connected — the camera will move there, but the map will have no features on it'

/**
 * The regions this dashboard can be pointed at.
 *
 * One is live: the ITR target the Sentiry endpoints watch. The rest are dimmed and
 * carry no indicator, because no feed is connected for them.
 *
 * They are **still clickable**, deliberately. Looking at a region we do not monitor
 * is a reasonable thing to want; being misled about whether it is monitored is not.
 * So the styling says "nothing is watching here" and the button still flies you
 * there — rather than a `disabled` attribute, which would say "this is broken".
 */
export function ViewPresets({ onSelect }: ViewPresetsProps) {
  const liveCount = VIEW_PRESETS.filter((preset) => preset.live).length

  return (
    <Panel className="w-[268px]">
      <PanelHeader>
        <PanelTitle>REGION PRESETS</PanelTitle>
        <span className="numeric flex items-center gap-1.5 text-[10px] font-bold text-status-live">
          <span aria-hidden className="size-1.5 animate-pulse-live rounded-full bg-status-live" />
          {liveCount} LIVE
        </span>
      </PanelHeader>

      <div className="grid grid-cols-2 gap-1.5 p-2.5">
        {VIEW_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => onSelect(preset)}
            title={preset.live ? undefined : NO_FEED_HINT}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-left text-xs font-semibold transition-colors',
              'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
              preset.live
                ? // The live region carries the accent rim and the same pulsing dot
                  // the status pill uses — one visual grammar for "this is running".
                  'border-accent-line bg-accent-soft text-fg hover:border-accent hover:bg-hover'
                : 'border-line bg-control text-fg-subtle hover:border-accent hover:bg-hover hover:text-fg',
            )}
          >
            {preset.live && (
              <span aria-hidden className="size-1.5 flex-none animate-pulse-live rounded-full bg-status-live" />
            )}
            <span className="truncate">{preset.label}</span>
          </button>
        ))}
      </div>
    </Panel>
  )
}
