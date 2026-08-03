import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type Size = 'sm' | 'md' | 'lg'

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'size-[22px]',
  md: 'size-[26px]',
  lg: 'size-[34px]',
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: Size
  /** `title` doubles as the accessible name, so it is required. */
  title: string
}

/**
 * Square, subtly-filled button holding a single icon. Used for every rail
 * collapse, close, refresh and zoom control.
 */
export function IconButton({ size = 'sm', className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={props.title}
      className={cn(
        'grid flex-none place-items-center rounded-md bg-control text-fg-muted transition-colors',
        'hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        'disabled:cursor-default disabled:opacity-50',
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  )
}
