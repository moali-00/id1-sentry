import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface PanelProps {
  children: ReactNode
  className?: string
  /** Only for staggering the entrance animation via `animationDelay`. */
  style?: CSSProperties
}

/**
 * A floating chrome surface over the map — rails, the legend, the status pill.
 *
 * `pointer-events-auto` is deliberate: the chrome layer disables pointer events
 * so map gestures pass through the gaps, and each panel re-enables them for
 * itself.
 */
export function Panel({ children, className, style }: PanelProps) {
  return (
    <div
      style={style}
      className={cn(
        'panel-surface pointer-events-auto rounded-xl border border-line bg-panel backdrop-blur-md',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Small uppercase heading used at the top of each rail. */
export function PanelHeader({ children, className }: PanelProps) {
  return <div className={cn('flex items-center gap-1.5 border-b border-line px-3 py-2.5', className)}>{children}</div>
}

export function PanelTitle({ children, className }: PanelProps) {
  return <span className={cn('flex-1 text-[10px] font-bold tracking-[0.08em] text-title', className)}>{children}</span>
}
