import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
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

/**
 * A single activity item. Hovering locates it; clicking flies to it.
 *
 * Rows from a social post carry a preview and a link to the original. The link
 * is a separate control rather than the row's own action: clicking the row
 * moves the map, and navigating away from the dashboard instead would be a
 * different thing entirely.
 */
export function FeedRow({ item, active, onHoverChange, onSelect }: FeedRowProps) {
  const [imageFailed, setImageFailed] = useState(false)
  // Hotlinked from the platform rather than archived, so it can vanish.
  const thumbnail = imageFailed ? undefined : item.thumbnail

  return (
    <div
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      className={cn(
        'group relative border-b border-line-soft transition-colors duration-150',
        active ? 'bg-active' : 'bg-transparent',
      )}
    >
      <button
        type="button"
        onFocus={() => onHoverChange(true)}
        onBlur={() => onHoverChange(false)}
        onClick={onSelect}
        className="w-full px-2.5 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        {/* The open-in-new-tab link is positioned over this row — it cannot be
            nested inside the button — so leave it a gutter rather than letting
            it land on top of the timestamp. */}
        <div className={cn('flex items-center gap-1.5', item.url && 'pr-5')}>
          <PlatformBadge platform={item.platform} />
          <span className="min-w-0 flex-1 truncate text-[11px] text-fg-muted">
            {item.author ? `@${item.author}` : item.watchName}
          </span>
          <span className="flex-none text-[10px] text-fg-subtle">{item.time}</span>
        </div>

        <div className="my-1.5 flex gap-2">
          {thumbnail && (
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="size-[46px] flex-none rounded-md bg-inset object-cover"
            />
          )}
          <p className="min-w-0 flex-1 text-xs leading-snug text-fg">{item.text}</p>
        </div>

        <div className="flex items-center gap-1.5">
          <CategorySwatch category={item.category} shape="circle" className="size-[9px]" />
          <span className="text-[10px] font-semibold text-fg-muted">{CATEGORIES[item.category].label}</span>
          <SuggestedTag />
          <ConfidenceMeter score={item.confidence} className="ml-auto" />
        </div>
      </button>

      {item.url && (
        <a
          href={item.url}
          target="_blank"
          // Without `noopener` the opened tab can reach back through `window.opener`.
          rel="noreferrer noopener"
          title="Open the original post in a new tab"
          className="absolute top-1.5 right-1.5 rounded-md p-1 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-hover hover:text-fg focus-visible:opacity-100"
        >
          <ExternalLink className="size-3" aria-hidden />
        </a>
      )}
    </div>
  )
}
