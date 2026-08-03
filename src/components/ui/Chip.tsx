import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface ChipProps {
  children: ReactNode
  active: boolean
  onClick: () => void
  /** Dashed outline marks a chip that widens a selection rather than filtering it. */
  dashed?: boolean
  className?: string
}

/** Toggleable filter pill used for platforms and languages in the watch form. */
export function Chip({ children, active, onClick, dashed = false, className }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-md border-[1.5px] px-3 py-1.5 text-xs font-semibold transition-colors',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        dashed ? 'border-dashed' : 'border-solid',
        active ? 'border-accent bg-accent text-white' : 'border-line bg-control text-fg hover:border-accent',
        className,
      )}
    >
      {children}
    </button>
  )
}
