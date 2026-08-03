import { cn } from '@/utils/cn'

/** Inline busy indicator for buttons mid-save. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white',
        className,
      )}
    />
  )
}
