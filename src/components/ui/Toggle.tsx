import { cn } from '@/utils/cn'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Accessible name. Not rendered — the caller supplies any visible label. */
  label: string
  /** `sm` for rail rows, `md` for forms and panels. */
  size?: 'sm' | 'md'
  title?: string
  disabled?: boolean
  className?: string
}

/**
 * Track and knob geometry per size.
 *
 * The knob travel is `track width − knob size − 2×inset`, worked out here rather
 * than left to a utility so the knob lands flush against the same 2px margin at
 * both ends. Getting that wrong by a pixel is the difference between a switch
 * that looks machined and one that looks approximate.
 */
const SIZES = {
  sm: { track: 'h-4 w-7', knob: 'size-3', on: 'translate-x-[14px]' },
  md: { track: 'h-[18px] w-8', knob: 'size-3.5', on: 'translate-x-[16px]' },
} as const

/**
 * A two-state switch.
 *
 * Distinct from `Chip` and `LayerRow`, which are also on/off but say so with a
 * fill and an ON/OFF pill. A switch is the right control when the setting
 * describes something that *will happen later* rather than something visible
 * now — a layer toggle changes the map under your cursor, whereas this kind of
 * setting only shows its effect after a save. The sliding knob is what carries
 * that difference.
 *
 * `role="switch"` rather than a checkbox: screen readers announce it as on/off,
 * which is what the two states mean here, and it needs no paired `<label>` since
 * the accessible name comes in as a prop.
 */
export function Toggle({ checked, onChange, label, size = 'md', title, disabled = false, className }: ToggleProps) {
  const geometry = SIZES[size]

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex flex-none items-center rounded-full transition-colors',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        geometry.track,
        checked ? 'bg-accent' : 'bg-off',
        disabled && 'cursor-default opacity-50',
        className,
      )}
    >
      {/*
        White in both states and in both palettes. The knob is a physical object
        on a coloured track, not a piece of text — it takes no theme token,
        because a knob that changed colour with the surface would read as a
        second state the switch does not have.
      */}
      <span
        aria-hidden
        className={cn(
          'inline-block rounded-full bg-white shadow-sm transition-transform',
          geometry.knob,
          checked ? geometry.on : 'translate-x-[2px]',
        )}
      />
    </button>
  )
}
