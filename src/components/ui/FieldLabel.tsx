import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface FieldLabelProps {
  children: ReactNode
  /** Set when the label describes a form control, to wire up `htmlFor`. */
  htmlFor?: string
  className?: string
}

/** The small uppercase caption above every field, stat and section. */
export function FieldLabel({ children, htmlFor, className }: FieldLabelProps) {
  const classes = cn('mb-1.5 block text-[10px] font-bold tracking-[0.07em] text-fg-subtle', className)

  return htmlFor ? (
    <label htmlFor={htmlFor} className={classes}>
      {children}
    </label>
  ) : (
    <div className={classes}>{children}</div>
  )
}
