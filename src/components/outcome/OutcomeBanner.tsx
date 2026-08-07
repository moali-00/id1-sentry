import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, CircleCheckBig } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { VERDICT_COLOR } from '@/utils/outcome'
import { useAppSelector } from '@/store/store'
import { selectResolution } from '@/store/slices/outcomeSlice'

/**
 * The event resolved, stated over the map.
 *
 * It sits directly above the assessment strip, and the pairing is the design.
 * The strip beneath says what the dashboard *expected* from open sources; this
 * says what actually happened, and how much of that expectation survived contact
 * with it. Read together, top to bottom, they are the whole product argument —
 * separated, the assessment reads as an unanswered question a day after it was
 * answered.
 *
 * Deliberately shallow, like the strip. The four counts are a summary, not a
 * finding; the findings are one click away in the review.
 */

const TALLY_ORDER = [
  { key: 'correct', label: 'called' },
  { key: 'consistent', label: 'corroborated' },
  { key: 'wrong', label: 'missed' },
  { key: 'unproven', label: 'unproven' },
] as const

/** `2026-08-06` → `6 Aug`. The year is on screen everywhere else. */
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function OutcomeBanner() {
  const navigate = useNavigate()
  const resolution = useAppSelector(selectResolution)

  // Nothing is claimed until the capture is in. There is no loading state here
  // on purpose: an empty slot is honest, whereas a skeleton would assert that a
  // resolution exists before this build knows one does.
  if (!resolution) return null

  const { system, launchDate, announcedAt, tally } = resolution

  return (
    <Panel
      className="animate-rise w-[560px] max-w-[calc(100vw-2rem)] overflow-hidden"
      style={{ animationDelay: '120ms' }}
    >
      <button
        type="button"
        onClick={() => void navigate('/outcome')}
        title="Open the after-action review"
        className="group flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors hover:bg-hover focus-visible:outline-none"
      >
        <span
          className="flex flex-none items-center gap-1.5 rounded-md px-1.5 py-0.5 label-micro"
          style={{
            color: VERDICT_COLOR.correct,
            background: `color-mix(in srgb, ${VERDICT_COLOR.correct} 14%, transparent)`,
            border: `1px solid ${VERDICT_COLOR.correct}55`,
          }}
        >
          <CircleCheckBig className="size-2.5" strokeWidth={3} aria-hidden />
          RESOLVED
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11.5px] font-semibold text-fg">
            {system} fired {shortDate(launchDate)} · announced {announcedAt.slice(11, 16)}Z
          </span>
          <span className="flex items-center gap-2 text-[10.5px] text-fg-subtle">
            {TALLY_ORDER.map(({ key, label }) => (
              <span key={key} className="flex items-center gap-1">
                <span aria-hidden className="size-1.5 rounded-full" style={{ background: VERDICT_COLOR[key] }} />
                <span className="numeric font-bold text-fg-muted">{tally[key]}</span> {label}
              </span>
            ))}
          </span>
        </span>

        <ArrowUpRight
          className="size-4 flex-none text-fg-subtle transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
          aria-hidden
        />
      </button>
    </Panel>
  )
}
