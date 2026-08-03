import { Keyboard, X } from 'lucide-react'
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { IconButton } from '@/components/ui/IconButton'

/**
 * The `?` help sheet.
 *
 * Reads its rows straight from the `SHORTCUTS` table the handler uses, so the
 * documentation cannot drift from the behaviour.
 */
export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  useEscapeKey(onClose)

  return (
    <div className="pointer-events-auto absolute inset-0 z-[1003] grid place-items-center">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close shortcuts"
        className="absolute inset-0 cursor-default bg-scrim-strong"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="relative w-[340px] rounded-xl border border-line bg-surface p-4 shadow-2xl"
      >
        <header className="mb-3 flex items-center gap-2 border-b border-line pb-2.5">
          <Keyboard className="size-4 text-accent" aria-hidden />
          <h2 className="flex-1 text-[11px] font-bold tracking-[0.08em] text-fg">KEYBOARD SHORTCUTS</h2>
          <IconButton title="Close shortcuts" onClick={onClose}>
            <X className="size-3.5" aria-hidden />
          </IconButton>
        </header>

        <dl className="flex flex-col gap-1.5">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keyLabel} className="flex items-center gap-3">
              <dd className="flex-1 text-xs text-fg">{shortcut.description}</dd>
              <dt className="rounded-md border border-line bg-control px-2 py-0.5 font-mono text-[10px] font-bold text-fg-muted">
                {shortcut.keyLabel}
              </dt>
            </div>
          ))}
        </dl>

        <p className="mt-3 border-t border-line pt-2.5 text-center text-[10px] text-fg-subtle">
          Shortcuts are ignored while typing in a field.
        </p>
      </div>
    </div>
  )
}
