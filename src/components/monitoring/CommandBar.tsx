import { useRef } from 'react'
import { Compass, HelpCircle, Share2, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useOutsideClick } from '@/hooks/useOutsideClick'
import { SearchBar, type SearchHit } from '@/components/monitoring/SearchBar'
import { SharePanel } from '@/components/monitoring/SharePanel'
import { DisplayPanel } from '@/components/monitoring/DisplayPanel'
import { ViewPresets } from '@/components/monitoring/ViewPresets'
import type { ViewPreset } from '@/utils/constants'
import { IconButton } from '@/components/ui/IconButton'
import { Panel } from '@/components/ui/Panel'

/** Which popover, if any, is open beneath the bar. */
export type CommandPopover = 'presets' | 'display' | 'share' | null

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
 * The bar beneath the status pill: search, region presets, display, share, help.
 *
 * Grouped into one row rather than scattered around the map edges so the
 * "act on the whole view" controls sit together, leaving the corners to the
 * rails and readouts. Display settings belong here for the same reason — where
 * the camera points and how the surface is drawn are the same kind of decision,
 * and neither is a data layer.
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

  // Spans the icon row and the popover it opens, so the toggles keep working:
  // pressing an active one is an inside click, and its own handler closes it.
  // The search field is deliberately outside — typing a query is a move away
  // from whatever popover was open.
  const controlsRef = useRef<HTMLDivElement>(null)
  useOutsideClick([controlsRef], () => onPopoverChange(null), popover !== null)

  return (
    // 70px clears the status pill, which starts at 16px and is ~42px tall.
    // At 52 the two rows overlapped by a few pixels and read as one blob.
    <div className="pointer-events-none absolute top-[70px] left-1/2 flex -translate-x-1/2 items-start gap-3">
      <SearchBar onSelect={onSearchSelect} focusToken={focusToken} />

      <div ref={controlsRef} className="relative">
        <Panel className="pointer-events-auto flex items-center gap-1 rounded-full p-1.5">
          <IconButton
            size="md"
            title="Region presets"
            aria-expanded={popover === 'presets'}
            onClick={() => toggle('presets')}
            className={cn('rounded-full', popover === 'presets' && 'text-accent')}
          >
            <Compass className="size-3.5" aria-hidden />
          </IconButton>

          <IconButton
            size="md"
            title="Display — projection, basemap, overlays"
            aria-expanded={popover === 'display'}
            onClick={() => toggle('display')}
            className={cn('rounded-full', popover === 'display' && 'text-accent')}
          >
            <SlidersHorizontal className="size-3.5" aria-hidden />
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
            {popover === 'presets' && (
              <ViewPresets
                onSelect={(preset) => {
                  onPresetSelect(preset)
                  onPopoverChange(null)
                }}
              />
            )}
            {/* Stays open while you work: switching basemap then projection then an
                overlay is one task, not three. */}
            {popover === 'display' && <DisplayPanel />}
            {popover === 'share' && <SharePanel />}
          </div>
        )}
      </div>
    </div>
  )
}
