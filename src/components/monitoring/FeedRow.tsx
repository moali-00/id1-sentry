import { cn } from '@/utils/cn'
import { CATEGORIES } from '@/utils/constants'
import type { FeedItem } from '@/types/monitoring'
import { CategorySwatch, PlatformBadge, SuggestedTag } from '@/components/ui/Badges'
import { ConfidenceMeter } from '@/components/ui/ConfidenceMeter'

interface FeedRowProps {
  item: FeedItem
  /** The row's cluster is hovered or selected on the map. */
  active: boolean
  onHoverChange: (hovered: boolean) => void
  onSelect: () => void
}

/** A single activity item. Hovering locates its cluster; clicking flies to it. */
export function FeedRow({ item, active, onHoverChange, onSelect }: FeedRowProps) {
  return (
    <button
      type="button"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocus={() => onHoverChange(true)}
      onBlur={() => onHoverChange(false)}
      onClick={onSelect}
      className={cn(
        'w-full border-b border-line-soft px-2.5 py-2.5 text-left transition-all duration-150',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        active ? 'bg-active' : 'bg-transparent',
      )}
    >
      <div className="flex items-center gap-1.5">
        <PlatformBadge platform={item.platform} />
        <span className="flex-1 truncate text-[11px] text-fg-muted">{item.watchName}</span>
        <span className="text-[10px] text-fg-subtle">{item.time}</span>
      </div>

      <p className="my-1.5 text-xs leading-snug text-fg">{item.text}</p>

      <div className="flex items-center gap-1.5">
        <CategorySwatch category={item.category} shape="circle" className="size-[9px]" />
        <span className="text-[10px] font-semibold text-fg-muted">{CATEGORIES[item.category].label}</span>
        <SuggestedTag />
        <ConfidenceMeter score={item.confidence} className="ml-auto" />
      </div>
    </button>
  )
}
