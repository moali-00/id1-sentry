import { useEffect, useRef, type RefObject } from 'react'

type InsideRef = RefObject<HTMLElement | null>

/**
 * Run `onOutside` when a pointer goes down anywhere outside every one of
 * `insideRefs`, while `enabled`. The companion to {@link useEscapeKey}: together
 * they give each popover the two dismissals an operator expects without either
 * one needing a full-screen scrim.
 *
 * Pointer-down rather than click, so a popover clears the moment a map drag
 * begins rather than after it ends. A drag that *starts* inside — selecting the
 * share URL and releasing over the map — is still an inside interaction, which
 * is exactly why the down event is the one that decides.
 *
 * Capture phase, so a panel that stops propagation of its own events cannot
 * leave the popover stuck open.
 *
 * The control that opened the overlay belongs in `insideRefs` too. Left out, its
 * pointer-down closes the overlay a beat before its click reopens it, and the
 * toggle appears dead.
 */
export function useOutsideClick(insideRefs: InsideRef[], onOutside: () => void, enabled = true): void {
  // Read through a ref so a fresh callback or a new array literal each render
  // does not tear the listener down and put it back.
  const latest = useRef({ insideRefs, onOutside })
  useEffect(() => {
    latest.current = { insideRefs, onOutside }
  })

  useEffect(() => {
    if (!enabled) return

    const handler = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (latest.current.insideRefs.some((ref) => ref.current?.contains(target))) return
      latest.current.onOutside()
    }

    document.addEventListener('pointerdown', handler, true)
    return () => document.removeEventListener('pointerdown', handler, true)
  }, [enabled])
}
