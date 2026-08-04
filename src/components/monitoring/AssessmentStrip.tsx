import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Radar } from 'lucide-react'
import { plainText } from '@/utils/format'
import { levelColor } from '@/utils/levels'
import { Panel } from '@/components/ui/Panel'
import { useAppSelector } from '@/store/store'
import {
  selectAssessment,
  selectItrStatus,
  selectSocial,
  selectThermal,
  selectWarnings,
  selectWindows,
} from '@/store/slices/itrSlice'

/**
 * A one-line read of the current assessment, and the way into the dossier.
 *
 * Deliberately shallow. The level and score belong to the target card, and the
 * indicators, blind spots and windows belong to the dossier — this strip exists
 * to put the *reasoning* on screen at all times and to be the obvious thing to
 * click when it raises a question.
 */

function windowLabel(startsInHours: number | undefined): string {
  if (startsInHours === undefined || startsInHours <= 0) return 'active now'
  if (startsInHours < 24) return `in ${Math.round(startsInHours)}h`
  return `in ${Math.round(startsInHours / 24)}d`
}

export function AssessmentStrip() {
  const navigate = useNavigate()

  const assessment = useAppSelector(selectAssessment)
  const windows = useAppSelector(selectWindows)
  const warnings = useAppSelector(selectWarnings)
  const thermal = useAppSelector(selectThermal)
  const social = useAppSelector(selectSocial)
  const status = useAppSelector(selectItrStatus)

  if (!assessment) {
    return (
      <Panel className="animate-rise pointer-events-auto flex items-center gap-2 px-3.5 py-2">
        <Radar className="size-3.5 animate-pulse text-fg-subtle" aria-hidden />
        <span className="text-[11px] text-fg-muted">
          {status === 'error' ? 'Assessment unavailable' : 'Loading assessment…'}
        </span>
      </Panel>
    )
  }

  const color = levelColor(assessment.level)
  const activeCount = windows?.active_windows.length ?? assessment.active_windows.length
  const next = assessment.next_window

  return (
    <Panel
      className="animate-rise pointer-events-auto w-[560px] max-w-[calc(100vw-2rem)] overflow-hidden"
      style={{ animationDelay: '200ms' }}
    >
      <button
        type="button"
        onClick={() => void navigate('/target')}
        title="Open the full dossier"
        className="group flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-hover focus-visible:outline-none"
      >
        <span
          aria-hidden
          className="h-8 w-[3px] flex-none rounded-full"
          style={{ background: `linear-gradient(180deg, ${color}, ${color}44)` }}
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11.5px] font-semibold text-fg">{plainText(assessment.narrative)}</span>
          <span className="block truncate text-[10.5px] text-fg-subtle">
            {warnings.length} warnings · {thermal.length} thermal · {social.length} posts · {assessment.gaps.length}{' '}
            blind spots
          </span>
        </span>

        {activeCount > 0 ? (
          <span className="flex flex-none items-center gap-1.5 rounded-md border border-cat-conflict/30 bg-cat-conflict/10 px-2 py-1 text-[10px] font-bold text-cat-conflict">
            <span aria-hidden className="size-1.5 animate-pulse-live rounded-full bg-cat-conflict" />
            WINDOW OPEN
          </span>
        ) : (
          next && (
            <span className="flex-none text-[10px] font-semibold text-fg-muted">
              next {windowLabel(next.starts_in_hours)}
            </span>
          )
        )}

        <ArrowUpRight
          className="size-4 flex-none text-fg-subtle transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
          aria-hidden
        />
      </button>
    </Panel>
  )
}
