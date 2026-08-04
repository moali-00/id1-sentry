import { cn } from '@/utils/cn'
import { plainText } from '@/utils/format'
import { Panel } from '@/components/ui/Panel'
import { useAppSelector } from '@/store/store'
import { selectAllSources } from '@/store/slices/itrSlice'
import type { SourceHealth } from '@/types/sentiry'

/**
 * Which of the collection streams is actually reporting.
 *
 * The status pill can only say one thing about the whole picture; this says
 * which stream is behind it. That matters more than usual here: several degrade
 * rather than fail, and a degraded stream still contributes a *weaker*
 * assessment rather than none at all.
 *
 * Streams are named for what they watch, not for the service behind them —
 * whoever reads this needs to know that ship movements are thin, not which
 * vendor was slow.
 */

const STATUS_STYLE: Record<SourceHealth['status'], { dot: string; label: string; text: string }> = {
  ok: { dot: 'bg-status-observed', label: 'text-status-observed', text: 'REPORTING' },
  degraded: { dot: 'bg-status-inferred', label: 'text-status-inferred', text: 'PARTIAL' },
  error: { dot: 'bg-status-missing', label: 'text-status-missing', text: 'DOWN' },
  // The stream answered; it just had nothing to report. Counting that as "down"
  // would read as a blind spot when it is in fact a negative observation.
  empty: { dot: 'bg-fg-subtle', label: 'text-fg-muted', text: 'NOTHING SEEN' },
  unconfigured: { dot: 'bg-off', label: 'text-fg-subtle', text: 'OFF' },
}

/**
 * What each stream watches, in the operator's words.
 *
 * Anything unlisted falls back to its own name tidied up, so a stream added
 * upstream still reads sensibly rather than disappearing.
 */
const SOURCE_LABEL: Record<string, string> = {
  opensky: 'Aircraft tracking',
  sealagom: 'Maritime warnings',
  nga_msi: 'Navigation warnings',
  firms: 'Thermal detections',
  firms_wfs: 'Thermal detections · range',
  firms_wms: 'Thermal imagery',
  notam_aai: 'Airspace notices',
  skylink_notam: 'Airspace notices · danger areas',
  gdelt: 'News reporting',
  social: 'Social reporting',
  sociallinks: 'Social reporting · by platform',
  up42: 'Optical imagery',
  sentinel1: 'Radar imagery',
}

const labelFor = (id: string) => SOURCE_LABEL[id] ?? id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

/**
 * What a stream being down or partial actually costs.
 *
 * Some upstreams explain themselves usefully — the navigation-warning caveat is
 * worth reading. Others report only a transport failure, which is stripped on
 * the way in, leaving a red row with no reason beside it. A bare DOWN with no
 * consequence is alarming without being informative, so say which kind it is: a
 * stream that feeds the score leaves a hole in it, and one that does not is
 * worth knowing about but changes nothing.
 */
function consequenceOf(source: SourceHealth): string | undefined {
  if (source.status === 'ok' || source.status === 'empty') return undefined
  return source.used_for_assessment
    ? 'Not contributing to the current assessment.'
    : 'Not part of the assessment — the score is unaffected.'
}

export function SourceHealthPanel() {
  const sources = useAppSelector(selectAllSources)

  const counts = sources.reduce<Record<string, number>>((acc, source) => {
    acc[source.status] = (acc[source.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <Panel className="w-[340px] p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="label-micro text-title">COLLECTION STATUS</h2>
        <span className="text-[10px] text-fg-subtle">
          {(counts.ok ?? 0) + (counts.empty ?? 0)} reporting · {counts.degraded ?? 0} partial ·{' '}
          {(counts.error ?? 0) + (counts.unconfigured ?? 0)} down
        </span>
      </div>

      {sources.length === 0 ? (
        <p className="py-3 text-center text-[11px] text-fg-subtle">Nothing reporting yet.</p>
      ) : (
        <ul className="scroll-thin flex max-h-72 flex-col gap-1 overflow-y-auto">
          {sources.map((source) => {
            const style = STATUS_STYLE[source.status] ?? STATUS_STYLE.unconfigured
            const note = plainText(source.detail) || consequenceOf(source)

            return (
              <li key={source.source} className="rounded-md bg-inset px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span aria-hidden className={cn('size-1.5 flex-none rounded-full', style.dot)} />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-fg">
                    {labelFor(source.source)}
                  </span>
                  {source.used_for_assessment && (
                    <span className="flex-none rounded-[3px] bg-badge px-1 py-px text-[8px] font-bold text-badge-fg">
                      SCORED
                    </span>
                  )}
                  <span className={cn('flex-none text-[9.5px] font-bold tracking-[0.05em]', style.label)}>
                    {style.text}
                  </span>
                </div>

                {note && <p className="mt-1 text-[10px] leading-snug text-fg-subtle">{note}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
