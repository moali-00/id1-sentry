import { Compass, HelpCircle, Share2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { SearchBar, type SearchHit } from '@/components/monitoring/SearchBar'
import { SharePanel } from '@/components/monitoring/SharePanel'
import { ViewPresets } from '@/components/monitoring/ViewPresets'
import type { ViewPreset } from '@/utils/constants'
import { IconButton } from '@/components/ui/IconButton'
import { Panel } from '@/components/ui/Panel'

/** Which popover, if any, is open beneath the bar. */
export type CommandPopover = 'presets' | 'share' | null

interface CommandBarProps {
  popover: CommandPopover
  onPopoverChange: (popover: CommandPopover) => void
  onSearchSelect: (hit: SearchHit) => void
  onPresetSelect: (preset: ViewPreset) => void
  onOpenHelp: () => void
  /** Changes whenever a shortcut asks for the search field. */
  focusToken: number
}

/**
 * The bar beneath the status pill: search, theatre presets, share, help.
 *
 * Grouped into one row rather than scattered around the map edges so the
 * "act on the whole view" controls sit together, leaving the corners to the
 * rails and readouts.
 */
export function CommandBar({
  popover,
  onPopoverChange,
  onSearchSelect,
  onPresetSelect,
  onOpenHelp,
  focusToken,
}: CommandBarProps) {
  const toggle = (next: Exclude<CommandPopover, null>) => onPopoverChange(popover === next ? null : next)

  return (
    <div className="pointer-events-none absolute top-[52px] left-1/2 flex -translate-x-1/2 items-start gap-2">
      <SearchBar onSelect={onSearchSelect} focusToken={focusToken} />

      <Panel className="pointer-events-auto flex items-center gap-1 rounded-full p-1.5">
        <IconButton
          size="md"
          title="Jump to a theatre"
          aria-expanded={popover === 'presets'}
          onClick={() => toggle('presets')}
          className={cn('rounded-full', popover === 'presets' && 'text-accent')}
        >
          <Compass className="size-3.5" aria-hidden />
        </IconButton>

        <IconButton
          size="md"
          title="Share this view"
          aria-expanded={popover === 'share'}
          onClick={() => toggle('share')}
          className={cn('rounded-full', popover === 'share' && 'text-accent')}
        >
          <Share2 className="size-3.5" aria-hidden />
        </IconButton>

        <IconButton size="md" title="Keyboard shortcuts" onClick={onOpenHelp} className="rounded-full">
          <HelpCircle className="size-3.5" aria-hidden />
        </IconButton>
      </Panel>

      {popover !== null && (
        <div className="pointer-events-auto absolute top-[calc(100%+6px)] right-0">
          {popover === 'presets' ? (
            <ViewPresets
              onSelect={(preset) => {
                onPresetSelect(preset)
                onPopoverChange(null)
              }}
            />
          ) : (
            <SharePanel />
          )}
        </div>
      )}
    </div>
  )
}
