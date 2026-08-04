import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Check, Copy, Link2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Panel } from '@/components/ui/Panel'

/** How long the copied confirmation stays up. */
const CONFIRM_MS = 2000

/**
 * Copy a link to exactly what is on screen.
 *
 * The URL is already authoritative — `useMapUrlState` keeps the camera and
 * layer selection in the query string, and the path carries the open watch — so
 * this panel only has to surface `window.location` and copy it.
 */
export function SharePanel() {
  // Subscribing to location re-renders the panel as the URL is rewritten, so an
  // open panel never shows a stale link.
  const location = useLocation()
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const url = `${window.location.origin}${location.pathname}${location.search}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), CONFIRM_MS)
    } catch {
      // Clipboard access is denied outside a secure context — the URL is still
      // shown in full below, so it can be selected and copied by hand.
      setCopied(false)
    }
  }

  return (
    <Panel className="w-[320px] p-3">
      <h2 className="mb-2 flex items-center gap-1.5 label-micro text-title">
        <Link2 className="size-3.5" aria-hidden />
        SHARE THIS VIEW
      </h2>

      <p className="mb-2.5 text-[11px] leading-snug text-fg-subtle">
        Carries the camera position, the active layers and any open watch.
      </p>

      <p className="scroll-thin mb-2.5 max-h-16 overflow-y-auto rounded-md border border-line bg-inset px-2 py-1.5 font-mono text-[10px] break-all text-fg-muted">
        {url}
      </p>

      <button
        type="button"
        onClick={() => void copy()}
        className={cn(
          'flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold transition-colors',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
          copied ? 'bg-status-observed text-on-bright' : 'bg-accent text-accent-fg hover:opacity-90',
        )}
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </Panel>
  )
}
