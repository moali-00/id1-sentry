import { Check, CircleDashed, CircleSlash, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { VERDICT_COLOR, type VerdictKind } from '@/utils/outcome'

/**
 * How one pre-event call turned out.
 *
 * These are the only marks in the review that use the reserved status hues, and
 * they earn them: a verdict *is* a state, not an identity. Each carries an icon
 * and its own word as the capture wrote it, so the reading never rests on the
 * colour — which matters more here than usual, since two of the four states are
 * amber and grey and the difference between "corroborated" and "not shown" is
 * the difference this panel exists to make.
 */

const VERDICT_ICON: Record<VerdictKind, LucideIcon> = {
  correct: Check,
  // Consistent with the record, but not proof of it — an open circle rather
  // than a tick.
  consistent: CircleDashed,
  wrong: X,
  unproven: CircleSlash,
}

export function VerdictPill({ kind, label }: { kind: VerdictKind; label: string }) {
  const Icon = VERDICT_ICON[kind]
  const color = VERDICT_COLOR[kind]

  return (
    <span
      className="inline-flex flex-none items-center gap-1 rounded-md px-1.5 py-0.5 label-micro"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)`, border: `1px solid ${color}55` }}
    >
      <Icon className="size-2.5" strokeWidth={3} aria-hidden />
      {label}
    </span>
  )
}
