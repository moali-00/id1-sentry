import { useEffect, useRef } from 'react'

/**
 * Global keyboard shortcuts for the map surface.
 *
 * One table drives both the handler and the `?` help sheet, so the two cannot
 * disagree. Keys are matched on `event.key` rather than `event.code` — an
 * operator on a non-QWERTY layout should get the letter they see on the cap.
 */

export interface ShortcutActions {
  toggleLayers: () => void
  toggleActivity: () => void
  focusSearch: () => void
  togglePresets: () => void
  toggleShare: () => void
  resetView: () => void
  toggleFullscreen: () => void
  toggleHelp: () => void
  closeOverlays: () => void
}

export interface Shortcut {
  /** Shown in the help sheet. */
  keyLabel: string
  description: string
  action: keyof ShortcutActions
  matches: (event: KeyboardEvent) => boolean
}

const plain = (key: string) => (event: KeyboardEvent) =>
  !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === key

export const SHORTCUTS: Shortcut[] = [
  { keyLabel: 'L', description: 'Layers rail', action: 'toggleLayers', matches: plain('l') },
  { keyLabel: 'I', description: 'Activity feed', action: 'toggleActivity', matches: plain('i') },
  {
    keyLabel: '⌘K  /  /',
    description: 'Search',
    action: 'focusSearch',
    matches: (event) => ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') || plain('/')(event),
  },
  { keyLabel: 'P', description: 'Jump-to presets', action: 'togglePresets', matches: plain('p') },
  { keyLabel: 'S', description: 'Share this view', action: 'toggleShare', matches: plain('s') },
  { keyLabel: 'R', description: 'Reset to the opening view', action: 'resetView', matches: plain('r') },
  { keyLabel: 'F', description: 'Fullscreen', action: 'toggleFullscreen', matches: plain('f') },
  { keyLabel: '?', description: 'This help', action: 'toggleHelp', matches: (event) => event.key === '?' },
  { keyLabel: 'Esc', description: 'Close panels', action: 'closeOverlays', matches: (event) => event.key === 'Escape' },
]

/** A keystroke meant for a field is never a shortcut. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function useKeyboardShortcuts(actions: ShortcutActions): void {
  // Read through a ref so re-created handlers never rebind the listener.
  const actionsRef = useRef(actions)
  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return

      const shortcut = SHORTCUTS.find((candidate) => candidate.matches(event))
      if (!shortcut) return

      event.preventDefault()
      actionsRef.current[shortcut.action]()
    }

    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])
}
