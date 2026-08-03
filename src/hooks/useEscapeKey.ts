import { useEffect } from 'react'

/**
 * Run `onEscape` while `enabled`. Every dismissible overlay uses this so Escape
 * behaves consistently across the detail panel and the watch form.
 */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onEscape, enabled])
}
