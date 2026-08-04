import { cn } from '@/utils/cn'

interface Segment<T extends string> {
  id: T
  label: string
  /** Hover text. Worth writing where the label alone does not say what changes. */
  hint?: string
}

/**
 * A labelled row of mutually exclusive choices.
 *
 * Used where an on/off row per option would let the operator pick a state that
 * cannot exist — the basemap and the projection are both exactly one thing at a
 * time. `aria-pressed` rather than a radiogroup, because these act on the map
 * immediately rather than being submitted.
 */
export function SegmentedControl<T extends string>({
  label,
  segments,
  active,
  columns = 2,
  onSelect,
}: {
  label: string
  segments: Segment<T>[]
  active: T
  /** Two per row by default; the rail is 240px, which fits two comfortably. */
  columns?: 2 | 3
  onSelect: (id: T) => void
}) {
  return (
    <div className="mb-1 px-1">
      <p className="mb-1.5 label-micro text-fg-subtle">{label}</p>
      <div className={cn('grid gap-1', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {segments.map((segment) => (
          <button
            key={segment.id}
            type="button"
            onClick={() => onSelect(segment.id)}
            title={segment.hint}
            aria-pressed={active === segment.id}
            className={cn(
              'rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors',
              'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
              active === segment.id
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-line bg-control text-fg-muted hover:text-fg',
            )}
          >
            {segment.label}
          </button>
        ))}
      </div>
    </div>
  )
}
