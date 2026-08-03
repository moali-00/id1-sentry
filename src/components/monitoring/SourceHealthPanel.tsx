import { cn } from '@/utils/cn'
import { Panel } from '@/components/ui/Panel'
import { useAppSelector } from '@/store/store'
import { selectFailedFeeds, selectSources } from '@/store/slices/itrSlice'
import type { SourceHealth } from '@/types/sentiry'

/**
 * Per-source health for every upstream feed.
 *
 * The status pill can only say one thing about the whole system; this says which
 * of the eleven feeds is actually working. That matters here more than usual:
 * several of these upstreams degrade rather than fail — Reddit rate-limits,
 * the maritime free tier ships no parsed coordinates — and a degraded feed
 * still contributes a *weaker* assessment rather than none at all.
 */

const STATUS_STYLE: Record<SourceHealth['status'], { dot: string; label: string }> = {
  ok: { dot: 'bg-status-observed', label: 'text-status-observed' },
  degraded: { dot: 'bg-status-inferred', label: 'text-status-inferred' },
  error: { dot: 'bg-status-missing', label: 'text-status-missing' },
  unconfigured: { dot: 'bg-off', label: 'text-fg-subtle' },
}

export function SourceHealthPanel() {
  const sources = useAppSelector(selectSources)
  const failed = useAppSelector(selectFailedFeeds)

  const counts = sources.reduce<Record<string, number>>((acc, source) => {
    acc[source.status] = (acc[source.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <Panel className="w-[340px] p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[10px] font-bold tracking-[0.08em] text-title">SOURCE HEALTH</h2>
        <span className="text-[10px] text-fg-subtle">
          {counts.ok ?? 0} ok · {counts.degraded ?? 0} degraded · {(counts.error ?? 0) + (counts.unconfigured ?? 0)}{' '}
          down
        </span>
      </div>

      {sources.length === 0 ? (
        <p className="py-3 text-center text-[11px] text-fg-subtle">No source report yet.</p>
      ) : (
        <ul className="scroll-thin flex max-h-72 flex-col gap-1 overflow-y-auto">
          {sources.map((source) => {
            const style = STATUS_STYLE[source.status] ?? STATUS_STYLE.unconfigured

            return (
              <li key={source.source} className="rounded-md bg-inset px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span aria-hidden className={cn('size-1.5 flex-none rounded-full', style.dot)} />
                  <span className="flex-1 truncate font-mono text-[11px] font-semibold text-fg">{source.source}</span>
                  {source.used_for_assessment && (
                    <span className="flex-none rounded-[3px] bg-badge px-1 py-px text-[8px] font-bold text-badge-fg">
                      SCORED
                    </span>
                  )}
                  <span className={cn('flex-none text-[9.5px] font-bold tracking-[0.05em]', style.label)}>
                    {source.status.toUpperCase()}
                  </span>
                  {source.latency_ms !== null && (
                    <span className="flex-none font-mono text-[9.5px] text-fg-subtle tabular-nums">
                      {source.latency_ms}ms
                    </span>
                  )}
                </div>

                {source.detail && <p className="mt-1 text-[10px] leading-snug text-fg-subtle">{source.detail}</p>}
              </li>
            )
          })}
        </ul>
      )}

      {failed.length > 0 && (
        <p className="mt-2 rounded-md border border-status-missing/30 bg-status-missing/10 px-2 py-1.5 text-[10px] leading-snug text-status-missing">
          Could not reach: {failed.join(', ')}
        </p>
      )}
    </Panel>
  )
}
