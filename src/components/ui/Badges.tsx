import { cn } from '@/utils/cn'
import { categoryColor } from '@/utils/constants'
import type { CategoryKey } from '@/types/monitoring'

/**
 * Short codes for the platforms the feeds carry.
 *
 * The badge is a two-or-three character chip sitting beside the author's name;
 * anything longer pushes the name out of the row. Unlisted platforms keep their
 * first two letters rather than disappearing.
 */
const PLATFORM_CODE: Record<string, string> = {
  'Twitter/X': 'X',
  YouTube: 'YT',
  Telegram: 'TG',
  Instagram: 'IG',
  Facebook: 'FB',
  LinkedIn: 'IN',
  TikTok: 'TT',
  Snapchat: 'SC',
  BoardReader: 'BR',
  VK: 'VK',
  'GOOGLE NEWS': 'NEWS',
  'REDDIT SEARCH': 'RDT',
}

/** Source platform tag, e.g. `TG`, `X`, `VK`. */
export function PlatformBadge({ platform }: { platform: string }) {
  const code = PLATFORM_CODE[platform] ?? platform.slice(0, 2).toUpperCase()

  return (
    <span
      title={platform}
      className="flex-none rounded-[3px] bg-badge px-[5px] py-[2px] text-[8.5px] font-bold tracking-[0.03em] text-badge-fg"
    >
      {code}
    </span>
  )
}

/**
 * Marks a value the system inferred rather than one an analyst confirmed.
 * Amber is fixed here — it means "unverified" in both themes.
 */
export function SuggestedTag() {
  return (
    <span className="rounded-[3px] border border-cat-political/35 bg-cat-political/15 px-[5px] py-px text-[8px] font-bold tracking-[0.05em] text-cat-political">
      SUGGESTED
    </span>
  )
}

interface CategorySwatchProps {
  category: CategoryKey
  className?: string
  /** Circles read as points on the map; squares read as layers in the rails. */
  shape?: 'square' | 'circle'
}

/**
 * Colour chip identifying a threat category. The hue is data, so it is applied
 * inline rather than via a utility class.
 */
export function CategorySwatch({ category, className, shape = 'square' }: CategorySwatchProps) {
  return (
    <span
      aria-hidden
      style={{ background: categoryColor(category) }}
      className={cn('flex-none', shape === 'circle' ? 'rounded-full' : 'rounded-[3px]', 'size-3', className)}
    />
  )
}
