import { useCallback } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BookOpen,
  CloudSun,
  Clock,
  GitMerge,
  Radio,
  Satellite,
  ShieldCheck,
  Ship,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { plainText, relativeTime } from '@/utils/format'
import { levelColor } from '@/utils/levels'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useAppSelector } from '@/store/store'
import {
  selectAoi,
  selectAssessment,
  selectCoupledTrials,
  selectDangerAreas,
  selectEvacuations,
  selectHazards,
  selectSocialPosts,
  selectWeather,
  selectImagery,
  selectItrStatus,
  selectMissiles,
  selectSocial,
  selectSources,
  selectThermal,
  selectWarnings,
  selectWindows,
} from '@/store/slices/itrSlice'
import { FieldLabel } from '@/components/ui/FieldLabel'
import { IconButton } from '@/components/ui/IconButton'

/**
 * The full dossier for the ITR target, opened as a routed slide-over.
 *
 * This is the watch-detail pattern the dashboard already had, applied to the
 * one thing actually being watched: everything the feeds returned, in one
 * scrollable place, rather than spread across floating panels.
 *
 * Routing it rather than holding it in component state means a link can open
 * straight into the dossier and Back closes it.
 */

function windowLabel(startsInHours: number | undefined): string {
  if (startsInHours === undefined || startsInHours <= 0) return 'active now'
  if (startsInHours < 24) return `in ${Math.round(startsInHours)}h`
  return `in ${Math.round(startsInHours / 24)}d`
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-lg bg-inset px-2.5 py-2">
      <p className="numeric text-base leading-none font-bold text-fg">{value}</p>
      <p className="mt-1 text-[9.5px] leading-tight text-fg-subtle">{label}</p>
    </div>
  )
}

export default function TargetDetailPage() {
  const navigate = useNavigate()

  const aoi = useAppSelector(selectAoi)
  const assessment = useAppSelector(selectAssessment)
  const warnings = useAppSelector(selectWarnings)
  const windows = useAppSelector(selectWindows)
  const thermal = useAppSelector(selectThermal)
  const imagery = useAppSelector(selectImagery)
  const social = useAppSelector(selectSocial)
  const danger = useAppSelector(selectDangerAreas)
  const evacuations = useAppSelector(selectEvacuations)
  const weather = useAppSelector(selectWeather)
  const hazards = useAppSelector(selectHazards)
  const socialPosts = useAppSelector(selectSocialPosts)
  const missiles = useAppSelector(selectMissiles)
  const coupled = useAppSelector(selectCoupledTrials)
  const sources = useAppSelector(selectSources)
  const status = useAppSelector(selectItrStatus)

  const close = useCallback(() => void navigate('/'), [navigate])
  useEscapeKey(close)

  // A stale link, or the feeds never arrived — either way there is no dossier.
  if (!aoi && status !== 'loading') return <Navigate to="/" replace />

  const color = levelColor(assessment?.level)
  // `empty` means the feed answered with no detections — it worked.
  const okSources = sources.filter((source) => source.status === 'ok' || source.status === 'empty').length
  // How much of the scoring model went unobserved. The API reports this as
  // `confidence`, but a bare percentage next to a score reads as a hedge rather
  // than as "a fifth of the inputs are missing".
  const missingWeight = (assessment?.indicators ?? [])
    .filter((indicator) => !indicator.available)
    .reduce((total, indicator) => total + indicator.weight, 0)

  return (
    <>
      <button
        type="button"
        onClick={close}
        aria-label="Close dossier"
        className="pointer-events-auto absolute inset-0 z-[1001] cursor-default bg-scrim"
      />

      <aside
        aria-label={`${aoi?.target.name ?? 'Target'} dossier`}
        className="scroll-thin pointer-events-auto absolute inset-y-0 right-0 z-[1002] w-[440px] max-w-full overflow-y-auto border-l border-line bg-surface shadow-[-8px_0_32px_rgba(0,0,0,.3)]"
      >
        <div
          aria-hidden
          className="sticky top-0 h-[3px] w-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}33)` }}
        />

        <div className="flex flex-col gap-4 p-4 pb-8">
          <header className="flex items-start gap-2.5 border-b border-line pb-3.5">
            <div className="min-w-0 flex-1">
              <p className="label-micro text-fg-subtle">TARGET DOSSIER</p>
              <h2 className="truncate text-[17px] leading-tight font-bold text-fg">{aoi?.target.name}</h2>
              <p className="mt-0.5 text-[11px] text-fg-muted">{aoi?.target.facility}</p>
              {aoi?.target.aliases && aoi.target.aliases.length > 0 && (
                <p className="mt-0.5 text-[10.5px] text-fg-subtle">aka {aoi.target.aliases.join(', ')}</p>
              )}
            </div>
            <IconButton size="md" title="Close dossier" onClick={close}>
              <X className="size-4" aria-hidden />
            </IconButton>
          </header>

          {assessment && (
            <section className="rounded-xl border p-3" style={{ borderColor: `${color}4d`, background: `${color}12` }}>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="rounded-md px-2 py-0.5 text-[10px] font-bold tracking-[0.06em]"
                  style={{ color, background: `${color}22`, border: `1px solid ${color}55` }}
                >
                  {assessment.level.toUpperCase()}
                </span>
                <span className="numeric text-[11px] font-bold text-fg">{assessment.score.toFixed(2)}</span>
                <span className="text-[10.5px] text-fg-muted">
                  confidence {Math.round(assessment.confidence * 100)}%
                </span>
              </div>
              <p className="text-xs leading-relaxed text-fg">{plainText(assessment.narrative)}</p>
            </section>
          )}

          <section className="grid grid-cols-3 gap-2">
            <Stat value={warnings.length} label="Maritime warnings" />
            <Stat value={thermal.length} label="Thermal detections" />
            <Stat value={imagery.length} label="Imagery scenes" />
            <Stat value={social.length} label="Social items" />
            <Stat value={danger?.counts.upcoming_total ?? 0} label="Danger areas upcoming" />
            <Stat value={danger?.counts.active_total ?? 0} label="Danger areas active" />
            <Stat value={`${okSources}/${sources.length}`} label="Sources healthy" />
          </section>

          {assessment && assessment.indicators.length > 0 && (
            <section>
              <FieldLabel>INDICATORS · {assessment.indicators.length}</FieldLabel>
              {missingWeight > 0 && (
                <p className="mb-1.5 text-[10.5px] leading-snug text-fg-subtle">
                  {Math.round(missingWeight * 100)}% of the model&rsquo;s weight was not observed and is hatched below.
                  The {assessment.score.toFixed(2)} score is computed over the remaining{' '}
                  {Math.round((1 - missingWeight) * 100)}%, not over the whole model.
                </p>
              )}
              <ul className="flex flex-col gap-2.5">
                {assessment.indicators.map((indicator) => (
                  <li key={indicator.key} className={cn(!indicator.available && 'opacity-50')}>
                    <div className="flex items-baseline gap-2">
                      <span className="flex-1 truncate text-[11.5px] font-semibold text-fg">{indicator.label}</span>
                      <span className="numeric text-[9.5px] text-fg-subtle">w{indicator.weight.toFixed(2)}</span>
                      <span className="numeric text-[11px] font-bold text-fg">
                        {indicator.score === null ? '—' : indicator.score.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-meter-off">
                      {indicator.available ? (
                        <div
                          className="h-full rounded-full transition-[width] duration-700"
                          style={{
                            width: `${Math.round(Math.min(1, Math.max(0, indicator.score ?? 0)) * 100)}%`,
                            background: color,
                          }}
                        />
                      ) : (
                        // An unavailable indicator has no score. An empty track
                        // is indistinguishable from a measured 0.00, so hatch the
                        // full width instead: the weight is still in the model,
                        // it simply was not observed.
                        <div
                          className="h-full w-full rounded-full opacity-60"
                          style={{
                            backgroundImage: `repeating-linear-gradient(135deg, ${color}, ${color} 2px, transparent 2px, transparent 5px)`,
                          }}
                        />
                      )}
                    </div>
                    {indicator.detail && (
                      <p className="mt-1 text-[10.5px] leading-snug text-fg-subtle">{plainText(indicator.detail)}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {assessment && assessment.gaps.length > 0 && (
            <section>
              <FieldLabel>
                <span className="flex items-center gap-1.5 text-status-inferred">
                  <AlertTriangle className="size-3" aria-hidden />
                  BLIND SPOTS · {assessment.gaps.length}
                </span>
              </FieldLabel>
              <ul className="flex flex-col gap-1.5">
                {assessment.gaps.map((gap) => (
                  <li
                    key={gap}
                    className="rounded-lg border border-status-inferred/25 bg-status-inferred/10 px-2.5 py-2 text-[10.5px] leading-snug text-fg-muted"
                  >
                    {plainText(gap)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {weather && (
            <section>
              <FieldLabel>
                <span className="flex items-center gap-1.5">
                  <CloudSun className="size-3" aria-hidden />
                  LAUNCH WEATHER · {weather.summary.favourable} OF {weather.summary.windows_graded} FAVOURABLE
                </span>
              </FieldLabel>
              <p className="mb-1.5 text-[10.5px] leading-snug text-fg-subtle">{weather.interpretation}</p>
              <ul className="flex flex-col gap-1">
                {weather.window_verdicts
                  .filter((v) => v.verdict === 'favourable')
                  .slice(0, 6)
                  .map((v, index) => (
                    <li
                      key={`${v.start}-${index}`}
                      className="flex items-center gap-2 rounded-lg border border-status-observed/30 bg-status-observed/10 px-2.5 py-1.5"
                    >
                      <span className="font-mono text-[10px] font-bold text-status-observed">FAVOURABLE</span>
                      <span className="flex-1 truncate text-[10.5px] text-fg-muted">
                        {v.start.slice(5, 16).replace('T', ' ')}Z · {v.hours_covered}h
                      </span>
                      <span className="numeric text-[10px] text-fg-subtle">
                        {Math.round(v.mean_cloud_cover_pct)}% cloud
                      </span>
                    </li>
                  ))}
              </ul>
              {weather.summary.marginal_or_worse > 0 && (
                <p className="mt-1.5 text-[10px] text-fg-subtle">
                  {weather.summary.marginal_or_worse} further windows graded marginal or worse — mostly heavy cloud.
                </p>
              )}
            </section>
          )}

          {hazards && (
            <section>
              <FieldLabel>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3" aria-hidden />
                  CONFOUND CHECK
                </span>
              </FieldLabel>
              <p className="rounded-lg border border-line bg-inset px-2.5 py-2 text-[10.5px] leading-snug text-fg-muted">
                {hazards.verdict}
              </p>
              <p className="mt-1 text-[9.5px] text-fg-subtle italic">{hazards.role}</p>
            </section>
          )}

          {socialPosts && Object.keys(socialPosts.summary.named_systems ?? {}).length > 0 && (
            <section>
              <FieldLabel>SYSTEMS NAMED IN REPORTING</FieldLabel>
              <p className="mb-1.5 text-[10.5px] leading-snug text-fg-subtle">
                Across {socialPosts.summary.items_aoi_relevant} relevant posts. What open sources are *saying* — not
                what the geometry supports.
              </p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(socialPosts.summary.named_systems)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => (
                    <span
                      key={name}
                      className="rounded-md border border-line bg-inset px-1.5 py-0.5 text-[10px] text-fg-muted"
                    >
                      {name} <span className="font-mono font-bold text-fg">{count}</span>
                    </span>
                  ))}
              </div>
            </section>
          )}

          {socialPosts && Object.keys(socialPosts.summary.top_keywords ?? {}).length > 0 && (
            <section>
              <FieldLabel>WHAT REPORTING IS TALKING ABOUT</FieldLabel>
              <p className="mb-1.5 text-[10.5px] leading-snug text-fg-subtle">
                The terms that put a post in this dossier, over {socialPosts.period_of_interest}. Volume is attention,
                not corroboration — a widely repeated claim is still one claim.
              </p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(socialPosts.summary.top_keywords ?? {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([term, count]) => (
                    <span
                      key={term}
                      className="rounded-md border border-line bg-inset px-1.5 py-0.5 text-[10px] text-fg-muted"
                    >
                      {term} <span className="font-mono font-bold text-fg">{count}</span>
                    </span>
                  ))}
              </div>
            </section>
          )}

          {evacuations && evacuations.items.length > 0 && (
            <section>
              <FieldLabel>
                <span className="flex items-center gap-1.5">
                  <Users className="size-3" aria-hidden />
                  CIVIL PRECURSORS · {evacuations.evacuation_count}
                </span>
              </FieldLabel>
              <p className="mb-1.5 text-[10.5px] leading-snug text-fg-subtle">
                {plainText(evacuations.indicator.detail) ??
                  'Evacuation, road-closure and fishing-ban reports near the range.'}
              </p>
              <ul className="flex flex-col gap-1.5">
                {evacuations.items.map((item, index) => (
                  <li key={item.url || index} className="rounded-lg border border-line bg-inset p-2.5">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="line-clamp-2 text-[11px] leading-snug font-semibold text-fg hover:text-accent"
                    >
                      {item.title}
                    </a>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="rounded-[3px] bg-badge px-1 py-px text-[8px] font-bold text-badge-fg">
                        {item.platform.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      {(item.evacuation_terms ?? []).slice(0, 3).map((term) => (
                        <span
                          key={term}
                          className="rounded-[3px] border border-cat-unrest/35 bg-cat-unrest/12 px-1 py-px text-[8.5px] text-cat-unrest"
                        >
                          {term}
                        </span>
                      ))}
                      {(item.forward_looking_terms ?? []).slice(0, 2).map((term) => (
                        <span
                          key={term}
                          className="rounded-[3px] border border-cat-political/35 bg-cat-political/12 px-1 py-px text-[8.5px] text-cat-political"
                        >
                          {term}
                        </span>
                      ))}
                      {(item.matched_systems ?? []).map((system) => (
                        <span
                          key={system.key}
                          title={`${system.category} · ${system.range_km.min}–${system.range_km.max} km`}
                          className="rounded-[3px] border border-cat-conflict/35 bg-cat-conflict/12 px-1 py-px text-[8.5px] font-bold text-cat-conflict"
                        >
                          {system.name}
                        </span>
                      ))}
                      <span className="ml-auto font-mono text-[9.5px] text-fg-subtle">
                        {item.published_at.slice(0, 10)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {windows && (windows.active_windows.length > 0 || windows.upcoming_windows.length > 0) && (
            <section>
              <FieldLabel>
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3" aria-hidden />
                  LAUNCH WINDOWS · {windows.active_windows.length} ACTIVE, {windows.upcoming_windows.length} UPCOMING
                </span>
              </FieldLabel>
              <ul className="flex flex-col gap-1">
                {[...windows.active_windows, ...windows.upcoming_windows].slice(0, 10).map((entry, index) => (
                  <li
                    key={`${entry.warning}-${entry.window.start}-${index}`}
                    className="flex items-center gap-2 rounded-lg bg-inset px-2.5 py-2"
                  >
                    <span className="font-mono text-[10px] font-bold text-fg">{entry.warning}</span>
                    <span className="min-w-0 flex-1 truncate text-[10.5px] text-fg-muted">
                      {entry.kind?.replace(/_/g, ' ')} · {entry.window.start.slice(5, 16).replace('T', ' ')}Z
                    </span>
                    <span
                      className={cn(
                        'flex-none text-[10px] font-semibold',
                        entry.starts_in_hours === undefined ? 'text-cat-conflict' : 'text-fg-subtle',
                      )}
                    >
                      {windowLabel(entry.starts_in_hours)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {warnings.length > 0 && (
            <section>
              <FieldLabel>
                <span className="flex items-center gap-1.5">
                  <Ship className="size-3" aria-hidden />
                  {aoi?.warning_area ?? 'MARITIME WARNINGS'} · {warnings.length}
                </span>
              </FieldLabel>
              <ul className="flex flex-col gap-2">
                {warnings.map((warning) => (
                  <li key={warning.message_id} className="rounded-lg border border-line bg-inset p-2.5">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-fg">{warning.number}</span>
                      <span className="text-[10px] text-fg-muted">{warning.kind.replace(/_/g, ' ')}</span>
                      {warning.is_launch_indicator && (
                        <span className="rounded-[3px] border border-cat-conflict/35 bg-cat-conflict/15 px-1 py-px text-[8px] font-bold text-cat-conflict">
                          LAUNCH
                        </span>
                      )}
                      {warning.distance_to_island_km !== null && (
                        <span className="ml-auto numeric text-[10px] text-fg-subtle ">
                          {Math.round(warning.distance_to_island_km)} km
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-3 text-[10.5px] leading-snug text-fg-subtle">{warning.text}</p>

                    {warning.likely_systems && (
                      <div className="mt-2 border-t border-line-soft pt-2">
                        <p className="label-micro text-fg-subtle">
                          {warning.likely_systems.label.toUpperCase()} · {warning.likely_systems.confidence} confidence
                        </p>
                        <p className="mt-0.5 text-[10px] text-fg-subtle">{warning.likely_systems.basis}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {warning.likely_systems.consistent_systems.slice(0, 6).map((system) => (
                            <span
                              key={system.key}
                              className="rounded-[3px] border border-line bg-control px-1.5 py-px text-[9.5px] text-fg-muted"
                            >
                              {system.name}
                            </span>
                          ))}
                        </div>
                        {/* The API is emphatic that geometry narrows a field and
                            never identifies a system; the UI says so too. */}
                        <p className="mt-1 text-[9.5px] text-fg-subtle italic">
                          Corridor geometry narrows the candidate field — it does not identify a system.
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {imagery.length > 0 && (
            <section>
              <FieldLabel>
                <span className="flex items-center gap-1.5">
                  <Satellite className="size-3" aria-hidden />
                  IMAGERY · {imagery.length}
                </span>
              </FieldLabel>
              <ul className="flex flex-col gap-1">
                {imagery.map((scene) => (
                  <li key={scene.scene_id} className="flex items-center gap-2 rounded-lg bg-inset px-2.5 py-2">
                    <span className="text-[10.5px] font-semibold text-fg">{scene.constellation.toUpperCase()}</span>
                    <span className="flex-1 truncate text-[10px] text-fg-subtle">
                      {scene.resolution_m} m · {Math.round(scene.cloud_cover)}% cloud
                    </span>
                    <span className="font-mono text-[10px] text-fg-subtle">{scene.acquired_at.slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {coupled && coupled.pairs.length > 0 && (
            <section>
              <FieldLabel>
                <span className="flex items-center gap-1.5">
                  <GitMerge className="size-3" aria-hidden />
                  COUPLED TRIALS · {coupled.pair_count}
                </span>
              </FieldLabel>
              <p className="mb-1.5 text-[10.5px] leading-snug text-fg-subtle">
                A launch corridor near the island paired with a separate impact zone far downrange — together they imply
                one long-range trial rather than two unrelated exercises.
              </p>
              <ul className="flex flex-col gap-1.5">
                {coupled.pairs.map((pair, index) => (
                  <li
                    key={`${pair.near_warning.number}-${index}`}
                    className="rounded-lg border border-line bg-inset p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-fg">{pair.near_warning.number}</span>
                      <span className="text-[10px] text-fg-subtle">→</span>
                      <span className="font-mono text-[11px] font-bold text-fg">{pair.far_warning.number}</span>
                      <span className="ml-auto numeric text-[10.5px] font-bold text-cat-conflict ">
                        {Math.round(pair.impact_distance_km)} km
                      </span>
                    </div>
                    <p className="mt-1 text-[10.5px] text-fg-subtle">
                      bearing {Math.round(pair.bearing_deg)}° · {pair.near_warning.kind.replace(/_/g, ' ')}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {missiles && (
            <section>
              <FieldLabel>
                <span className="flex items-center gap-1.5">
                  <BookOpen className="size-3" aria-hidden />
                  SYSTEM REFERENCE · {missiles.count}
                </span>
              </FieldLabel>
              <p className="text-[10.5px] leading-snug text-fg-subtle">
                {missiles.families.length} families across {missiles.categories.length} categories.
              </p>
              <p className="mt-1.5 rounded-lg border border-line bg-inset px-2.5 py-2 text-[10px] leading-snug text-fg-subtle">
                {missiles.disclaimer}
              </p>
            </section>
          )}

          <section>
            <FieldLabel>
              <span className="flex items-center gap-1.5">
                <Radio className="size-3" aria-hidden />
                SITES
              </span>
            </FieldLabel>
            <p className="font-mono text-[11px] text-fg-muted">
              {aoi?.target.centre.lat.toFixed(4)}°N {aoi?.target.centre.lon.toFixed(4)}°E
            </p>
            <p className="text-[10.5px] text-fg-subtle">
              {aoi?.target.state}, {aoi?.target.country}
            </p>
            {aoi?.secondary_site && (
              <p className="mt-1.5 text-[10.5px] text-fg-subtle">Secondary: {aoi.secondary_site.name}</p>
            )}
          </section>

          {assessment && (
            <footer className="border-t border-line pt-3 text-[10px] text-fg-subtle">
              Assessment generated {relativeTime(Math.floor(Date.parse(assessment.generated_at) / 1000))} ago
            </footer>
          )}
        </div>
      </aside>
    </>
  )
}
