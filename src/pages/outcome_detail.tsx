import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  BadgeCheck,
  CloudSun,
  Crosshair,
  ExternalLink,
  Heart,
  MessageSquareQuote,
  Newspaper,
  Plane,
  Repeat2,
  Ruler,
  SatelliteDish,
  Ship,
  SquareStack,
  TrendingUpDown,
  X,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useAppDispatch, useAppSelector } from '@/store/store'
import {
  loadOutcomePosts,
  selectOutcome,
  selectOutcomePosts,
  selectOutcomeStatus,
  selectReversal,
  selectVerdictTally,
} from '@/store/slices/outcomeSlice'
import { VERDICT_COLOR, outcomeVerdict, trafficSeries, zoneVertexCount } from '@/utils/outcome'
import { FieldLabel } from '@/components/ui/FieldLabel'
import { IconButton } from '@/components/ui/IconButton'
import { Spinner } from '@/components/ui/Spinner'
import { ReversalChart } from '@/components/outcome/ReversalChart'
import { TrafficBaseline } from '@/components/outcome/TrafficBaseline'
import { VerdictPill } from '@/components/outcome/VerdictPill'
import { WindowWeather } from '@/components/outcome/WindowWeather'

/**
 * The after-action review, opened as a routed slide-over.
 *
 * The same pattern as the target dossier, applied to the opposite question. That
 * panel is the case *for* an expectation, assembled from feeds that were still
 * running; this one is what happened, and it is organised so that every place the
 * dashboard was wrong is as visible as the places it was right — the scorecard
 * leads with its own headline, which says that going beyond the schedule and the
 * candidate set produced nothing that held.
 *
 * It is wider than the dossier at 520px because it carries charts rather than
 * lists, and it is scrolled as one document rather than tabbed: a review read in
 * pieces stops being a review.
 */

/** `2026-08-06T13:24:12+00:00` → `6 Aug 13:24Z`. */
function stamp(iso: string): string {
  const at = new Date(iso)
  const date = at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `${date} ${at.toISOString().slice(11, 16)}Z`
}

function compact(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count)
}

function Section({ icon: Icon, title, children }: { icon: typeof Ship; title: string; children: ReactNode }) {
  return (
    <section>
      <FieldLabel>
        <span className="flex items-center gap-1.5">
          <Icon className="size-3" aria-hidden />
          {title}
        </span>
      </FieldLabel>
      {children}
    </section>
  )
}

/** A short note the reader should not mistake for a measurement. */
function Caveat({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[10px] leading-snug text-fg-subtle italic">{children}</p>
}

export default function OutcomeDetailPage() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const bundle = useAppSelector(selectOutcome)
  const status = useAppSelector(selectOutcomeStatus)
  const tally = useAppSelector(selectVerdictTally)
  const reversal = useAppSelector(selectReversal)
  const posts = useAppSelector(selectOutcomePosts)

  // The 196 kB sweep is only ever read here, so this panel is what asks for it.
  useEffect(() => {
    void dispatch(loadOutcomePosts())
  }, [dispatch])

  const close = useCallback(() => void navigate('/'), [navigate])
  useEscapeKey(close)

  const launchDate = bundle?.groundTruth.data.extracted_facts.launch_date ?? ''
  const insideDays = useMemo(
    () => (bundle ? trafficSeries(bundle.exclusion, 'inside', launchDate) : []),
    [bundle, launchDate],
  )
  const outsideDays = useMemo(
    () => (bundle ? trafficSeries(bundle.exclusion, 'outside', launchDate) : []),
    [bundle, launchDate],
  )

  const live = bundle?.adsb.part_3_live_sampling_during_an_active_closure
  // One scale across both series in the snapshot strip — they are the same unit.
  const livePeak = Math.max(...(live?.per_snapshot_total ?? [1]), 1)

  /**
   * Indicators dropped from the picture, deduplicated across the two captures
   * that record them. Matched on the leading word of the key, which is what the
   * scorecard's `gnss_interference` and the environment capture's `gnss` share.
   */
  const withdrawn = useMemo((): [string, string][] => {
    if (!bundle) return []
    const scored = Object.entries(bundle.scorecard.data.not_scored)
    const seen = new Set(scored.map(([key]) => key.split('_')[0]))

    return [
      ...scored,
      ...Object.entries(bundle.environment.data.omitted).filter(([key]) => !seen.has(key.split('_')[0])),
    ]
  }, [bundle])

  // A stale link, or the chunk failed — either way there is no review to read.
  if (!bundle && status === 'error') return <Navigate to="/" replace />

  const scorecard = bundle?.scorecard.data
  const truth = bundle?.groundTruth.data
  const announcement = truth?.official_announcement

  return (
    <>
      <button
        type="button"
        onClick={close}
        aria-label="Close after-action review"
        className="pointer-events-auto absolute inset-0 z-[1001] cursor-default bg-scrim"
      />

      <aside
        aria-label="After-action review"
        aria-busy={status === 'loading'}
        className="scroll-thin pointer-events-auto absolute inset-y-0 right-0 z-[1002] w-[520px] max-w-full overflow-y-auto border-l border-line bg-surface shadow-[-8px_0_32px_rgba(0,0,0,.3)]"
      >
        <div
          aria-hidden
          className="sticky top-0 h-[3px] w-full"
          style={{
            background: `linear-gradient(90deg, ${VERDICT_COLOR.correct}, ${VERDICT_COLOR.correct}33)`,
          }}
        />

        {!bundle ? (
          <div className="flex h-full items-center justify-center gap-2 p-8 text-[11px] text-fg-muted">
            <Spinner className="border-fg-subtle/30 border-t-fg-subtle" />
            Loading the review…
          </div>
        ) : (
          <div className="flex flex-col gap-5 p-4 pb-10">
            <header className="flex items-start gap-2.5 border-b border-line pb-3.5">
              <div className="min-w-0 flex-1">
                <p className="label-micro text-fg-subtle">AFTER-ACTION REVIEW</p>
                <h2 className="text-[17px] leading-tight font-bold text-fg">{truth?.extracted_facts.system} trial</h2>
                <p className="mt-0.5 text-[11px] text-fg-muted">{bundle.groundTruth.event}</p>
                <p className="mt-0.5 text-[10.5px] text-fg-subtle">
                  Captured {stamp(bundle.groundTruth.captured_at)} · covering {bundle.groundTruth.period}
                </p>
              </div>
              <IconButton size="md" title="Close review" onClick={close}>
                <X className="size-4" aria-hidden />
              </IconButton>
            </header>

            {/* ── The headline finding ───────────────────────────────────────
                First, and set as a pull quote rather than a paragraph. It is the
                scorecard's own summary of itself, and it is not flattering. */}
            <section
              className="rounded-xl border p-3"
              style={{
                borderColor: `${VERDICT_COLOR.correct}4d`,
                background: `color-mix(in srgb, ${VERDICT_COLOR.correct} 7%, transparent)`,
              }}
            >
              <p className="text-xs leading-relaxed text-fg">{scorecard?.headline}</p>
            </section>

            {/* ── Ground truth ───────────────────────────────────────────── */}
            <Section icon={BadgeCheck} title="GROUND TRUTH">
              <dl className="grid grid-cols-2 gap-1.5">
                {[
                  ['System', truth?.extracted_facts.system],
                  ['Class per MoD', truth?.extracted_facts.classification_by_mod],
                  ['Launched', truth?.extracted_facts.launch_date],
                  ['Announced', truth && stamp(truth.extracted_facts.announced_at_utc)],
                  ['Site as stated', truth?.extracted_facts.site_as_stated],
                  ['Authority', truth?.extracted_facts.conducting_authority],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-inset px-2.5 py-2">
                    <dt className="text-[9.5px] leading-tight text-fg-subtle">{label}</dt>
                    <dd className="mt-0.5 text-[11px] leading-snug font-semibold text-fg">{value}</dd>
                  </div>
                ))}
              </dl>

              {announcement && (
                <a
                  href={announcement.post_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block rounded-lg border border-line bg-inset p-2.5 transition-colors hover:border-accent"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10.5px] font-bold text-fg">@{announcement.author}</span>
                    <span className="truncate text-[10px] text-fg-subtle">{announcement.author_name}</span>
                    <ExternalLink className="ml-auto size-3 flex-none text-fg-subtle" aria-hidden />
                  </div>
                  {/* Trimmed at the tag block. The handles carry no information a
                      reader of this panel needs, and they are half the post. */}
                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-fg-muted">
                    {announcement.text.split('\n\n')[0]}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3 text-[9.5px] text-fg-subtle">
                    <span className="numeric">{compact(announcement.view_count ?? 0)} views</span>
                    <span className="numeric flex items-center gap-1">
                      <Heart className="size-2.5" aria-hidden />
                      {compact(announcement.like_count ?? 0)}
                    </span>
                    <span className="numeric flex items-center gap-1">
                      <Repeat2 className="size-2.5" aria-hidden />
                      {compact(announcement.retweet_count ?? 0)}
                    </span>
                  </div>
                </a>
              )}

              <Caveat>{truth?.classification_note}</Caveat>
            </Section>

            {/* ── The scorecard ──────────────────────────────────────────── */}
            <Section icon={Crosshair} title={`SCORECARD · ${scorecard?.calls.length ?? 0} CALLS`}>
              {tally && (
                <div className="mb-2 grid grid-cols-4 gap-1.5">
                  {(
                    [
                      ['correct', 'Called'],
                      ['consistent', 'Corroborated'],
                      ['wrong', 'Missed'],
                      ['unproven', 'Unproven'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="rounded-lg bg-inset px-2 py-1.5 text-center">
                      {/* The figure stays in ink and the swatch beneath carries
                          the verdict. A number painted in a status hue reads as
                          a coloured word rather than as a count, and it puts the
                          only bright thing in the tile on the digit rather than
                          on the state the digit is counting. */}
                      <p className="text-base leading-none font-bold text-fg">{tally[key]}</p>
                      <p className="mt-1 flex items-center justify-center gap-1 text-[9.5px] leading-tight text-fg-subtle">
                        <span
                          aria-hidden
                          className="size-1.5 rounded-full"
                          style={{ background: VERDICT_COLOR[key] }}
                        />
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <ul className="flex flex-col gap-2">
                {scorecard?.calls.map((call) => {
                  const verdict = outcomeVerdict(call)

                  // The verdict sits on its own line above the claim rather than
                  // beside it. `NOT DEMONSTRATED` is a third of the card's width
                  // in the micro-label face, and inline it left the claim
                  // wrapping in a column too narrow to read.
                  return (
                    <li key={call.claim} className="rounded-lg border border-line bg-inset p-2.5">
                      <VerdictPill kind={verdict.kind} label={verdict.label} />
                      <p className="mt-1.5 text-[11px] leading-snug font-semibold text-fg">{call.claim}</p>
                      <p className="mt-1 text-[10.5px] leading-relaxed text-fg-muted">{verdict.prose}</p>
                      <p className="mt-1.5 border-t border-line-soft pt-1.5 text-[9.5px] leading-snug text-fg-subtle">
                        <span className="label-micro">BASIS</span> · {call.basis}
                      </p>

                      {/* The weather call carries its own refutation. It is
                          rendered under the call it belongs to rather than in a
                          section of its own, because the hours only mean
                          anything as an answer to that claim. */}
                      {call.evidence && call.evidence.length > 0 && (
                        <div className="mt-2">
                          <WindowWeather hours={call.evidence} />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Section>

            {/* ── The social reversal ────────────────────────────────────── */}
            <Section icon={TrendingUpDown} title="WHAT REPORTING NAMED, BEFORE AND AFTER">
              <ReversalChart rows={reversal} />
              <p className="mt-2 rounded-lg border border-line bg-inset px-2.5 py-2 text-[10.5px] leading-relaxed text-fg-muted">
                {scorecard?.social_reversal.reading}
              </p>
            </Section>

            {/* ── Launch-day weather ─────────────────────────────────────── */}
            {bundle.weather.declared_window_6_aug.length > 0 && (
              <Section icon={CloudSun} title="OVER THE PAD, AS MEASURED">
                <p className="mb-1.5 text-[10.5px] leading-snug text-fg-subtle">{bundle.weather.note}</p>
                <WindowWeather hours={bundle.weather.declared_window_6_aug} />
                <Caveat>{bundle.weather.source}</Caveat>
              </Section>
            )}

            {/* ── The airspace exclusion test ────────────────────────────── */}
            <Section icon={Plane} title="DID THE CLOSURE EMPTY THE AIRSPACE?">
              <p className="mb-2 text-[10.5px] leading-snug text-fg-subtle">{bundle.exclusion.question}</p>

              <div className="flex flex-col gap-2">
                <TrafficBaseline
                  days={insideDays}
                  stats={bundle.exclusion.result.inside}
                  label="INSIDE VED-52"
                  caption={`${bundle.exclusion.cell_overlay.cells_inside_ved52} of ${bundle.exclusion.cell_overlay.aoi_cells} AOI cells fall within the closed circle.`}
                />
                <TrafficBaseline
                  days={outsideDays}
                  stats={bundle.exclusion.result.outside}
                  label="OUTSIDE VED-52"
                  caption={`The remaining ${bundle.exclusion.cell_overlay.cells_outside} cells — the control the inside count is read against.`}
                />
              </div>

              <ul className="mt-2 flex flex-col gap-1.5">
                {bundle.exclusion.finding.reasoning.map((line) => (
                  <li
                    key={line}
                    className="rounded-lg border border-line bg-inset px-2.5 py-2 text-[10.5px] leading-snug text-fg-muted"
                  >
                    {line}
                  </li>
                ))}
              </ul>

              {/* The negative result and the reason it is not a null result. The
                  capture is emphatic that the measurement is underpowered, and
                  showing the z-scores without this would read as proof of
                  absence. */}
              <div className="mt-2 rounded-lg border border-status-inferred/25 bg-status-inferred/10 px-2.5 py-2">
                <p className="label-micro mb-1 text-status-inferred">UNDERPOWERED — NOT A NULL RESULT</p>
                <p className="text-[10.5px] leading-relaxed text-fg-muted">{bundle.exclusion.power.verdict}</p>
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-fg-subtle">
                  {bundle.exclusion.finding.important_caveat}
                </p>
              </div>

              {/* ── Forward sampling ─────────────────────────────────────────
                  The daily aggregate could not answer the question, and the
                  launch hour cannot be reconstructed at all — no free source
                  serves it. So the same question was put forward instead, into a
                  closure window still in force. It belongs inside this section
                  rather than beside it: it is the second attempt at one test. */}
              {live && (
                <div className="mt-2 rounded-lg border border-line bg-inset p-2.5">
                  <p className="label-micro mb-1 text-fg-subtle">SAMPLED LIVE, INSIDE AN ACTIVE CLOSURE</p>
                  <p className="numeric text-[10px] text-fg-subtle">{live.window}</p>

                  {/* Ten one-minute snapshots. Total contacts against contacts
                    inside the circle, on one scale — they are the same unit and
                    the gap between them is the reading. */}
                  <ol className="mt-2 flex h-10 items-end gap-[3px]">
                    {live.per_snapshot_total.map((total, index) => (
                      <li
                        key={index}
                        title={`Snapshot ${index + 1} — ${total} contacts tracked, ${live.per_snapshot_inside_ved52[index]} inside VED-52`}
                        className="relative flex h-full flex-1 items-end"
                      >
                        <span
                          className="block w-full rounded-t-[3px] bg-meter-off"
                          style={{ height: `${(total / livePeak) * 100}%` }}
                        />
                        {live.per_snapshot_inside_ved52[index] > 0 && (
                          <span
                            aria-hidden
                            className="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-accent"
                            style={{ height: `${(live.per_snapshot_inside_ved52[index] / livePeak) * 100}%` }}
                          />
                        )}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-1.5 flex items-center gap-3 border-t border-line-soft pt-1.5 text-[9.5px] text-fg-subtle">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="size-1.5 rounded-[1px] bg-meter-off" />
                      tracked in 250 nm
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="size-1.5 rounded-[1px] bg-accent" />
                      inside VED-52
                    </span>
                    <span className="numeric ml-auto">{live.snapshots} snapshots · 60 s</span>
                  </div>

                  <p className="mt-2 text-[10.5px] leading-relaxed text-fg-muted">{live.interpretation.observed}</p>
                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-fg-subtle">
                    {live.interpretation.but_not_yet_evidence}
                  </p>
                </div>
              )}
            </Section>

            {/* ── What the sensors returned ──────────────────────────────────
                Four feeds that answered, and three of them answered zero. Shown
                because an empty feed that worked and a feed that failed look
                identical everywhere else, and the thermal indicator's null is
                the substance of one of the scorecard's calls. */}
            <Section icon={SatelliteDish} title="WHAT THE SENSORS RETURNED">
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  ['Thermal · pad box', bundle.environment.data.thermal_pad.count, 'FIRMS, 3-day window'],
                  ['Thermal · range box', bundle.environment.data.thermal_range.count, 'FIRMS, 3-day window'],
                  ['Natural-event confounds', bundle.environment.data.eonet.data.events_in_aoi, 'EONET, 200 scanned'],
                  [
                    'Airborne now',
                    Object.values(bundle.environment.data.aircraft_now.airborne_counts)[0] ?? 0,
                    `agreed across ${Object.keys(bundle.environment.data.aircraft_now.airborne_counts).length} networks`,
                  ],
                ].map(([label, count, note]) => (
                  <div key={label as string} className="rounded-lg bg-inset px-2.5 py-2">
                    <p className="numeric text-base leading-none font-bold text-fg">{count}</p>
                    <p className="mt-1 text-[9.5px] leading-tight text-fg-muted">{label}</p>
                    <p className="text-[9.5px] leading-tight text-fg-subtle">{note}</p>
                  </div>
                ))}
              </div>
              <Caveat>{bundle.environment.data.eonet.data.interpretation}</Caveat>
            </Section>

            {/* ── The geometry correction ────────────────────────────────── */}
            <Section icon={Ruler} title="GEOMETRY CORRECTION">
              <p className="mb-2 text-[11px] leading-snug font-semibold text-fg">
                {bundle.adsb.part_2_geometry_correction.finding}
              </p>
              <ul className="flex flex-col gap-1.5">
                {bundle.adsb.part_2_geometry_correction.measurements.map((measurement) => (
                  <li
                    key={measurement.place}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-2.5 py-2',
                      measurement.inside
                        ? 'border-status-observed/30 bg-status-observed/10'
                        : 'border-status-missing/30 bg-status-missing/10',
                    )}
                  >
                    <span className="flex-1 truncate text-[10.5px] font-semibold text-fg">{measurement.place}</span>
                    <span className="numeric text-[10px] text-fg-subtle">{measurement.km_from_centre} km</span>
                    <span
                      className="label-micro flex-none"
                      style={{ color: measurement.inside ? VERDICT_COLOR.correct : VERDICT_COLOR.wrong }}
                    >
                      {measurement.inside ? 'INSIDE' : 'OUTSIDE'} {measurement.margin_km} KM
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10.5px] leading-relaxed text-fg-muted">
                {bundle.adsb.part_2_geometry_correction.why_it_matters}
              </p>
              <Caveat>
                The map draws this correction — switch on <strong>Closure · verified</strong> beside{' '}
                <strong>Danger areas</strong> to see the published circle against the bounding box that replaced it.
              </Caveat>
            </Section>

            {/* ── The closed-zone register ───────────────────────────────── */}
            <Section
              icon={SquareStack}
              title={`CLOSED ZONES · ${bundle.zones.counts.airspace_zones} AIRSPACE, ${bundle.zones.counts.maritime_zones} MARITIME`}
            >
              <p className="mb-1.5 text-[10.5px] leading-snug text-fg-subtle">
                In force at {bundle.zones.valid_as_of}, measured from {bundle.zones.reference_point.name}.
              </p>
              <ul className="flex flex-col gap-1.5">
                {bundle.zones.zones.map((zone) => {
                  const vertices = zoneVertexCount(zone)
                  return (
                    <li key={zone.zone} className="rounded-lg border border-line bg-inset p-2.5">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[11px] font-bold text-fg">{zone.zone}</span>
                        <span className="min-w-0 flex-1 truncate text-[10px] text-fg-muted">
                          {zone.activity ?? zone.type}
                        </span>
                        <span className="numeric flex-none text-[9.5px] text-fg-subtle">
                          {vertices > 0 ? `${vertices} pts` : 'no geometry'}
                        </span>
                      </div>
                      {zone.windows && zone.windows.length > 0 && (
                        <p className="numeric mt-1 text-[9.5px] text-fg-subtle">{zone.windows.join(' · ')}</p>
                      )}
                      {zone.note && <p className="mt-1 text-[10px] leading-snug text-fg-muted">{zone.note}</p>}
                    </li>
                  )
                })}
              </ul>
            </Section>

            {/* ── Maritime, one day on ───────────────────────────────────── */}
            <Section icon={Ship} title="NAVAREA VIII, ONE DAY ON">
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  ['Still in force', bundle.maritime.data.still_in_force.length],
                  ['Cancelled', bundle.maritime.data.gone_since_capture.length],
                  ['New', bundle.maritime.data.new_since_capture.length],
                ].map(([label, count]) => (
                  <div key={label} className="rounded-lg bg-inset px-2.5 py-2">
                    <p className="numeric text-base leading-none font-bold text-fg">{count}</p>
                    <p className="mt-1 text-[9.5px] leading-tight text-fg-subtle">{label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[10.5px] leading-snug text-fg-subtle">
                {bundle.maritime.data.message_count_at_capture} messages at capture,{' '}
                {bundle.maritime.data.message_count_now} now. The launch warnings 818/26 and 819/26 are both still
                standing — the range has not stood down.
              </p>
            </Section>

            {/* ── Cross-source agreement ─────────────────────────────────── */}
            <Section icon={Newspaper} title="THREE SOURCES ON ONE MISSILE">
              <p className="mb-1.5 text-[10.5px] leading-snug text-fg-subtle">
                {bundle.press.cross_source_agreement.note}
              </p>
              <div className="overflow-hidden rounded-lg border border-line bg-inset">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-line-soft">
                      <th scope="col" className="label-micro px-2 py-1.5 text-left text-fg-subtle">
                        FIELD
                      </th>
                      <th scope="col" className="label-micro px-1 py-1.5 text-left text-fg-subtle">
                        MOD
                      </th>
                      <th scope="col" className="label-micro px-1 py-1.5 text-left text-fg-subtle">
                        CSIS
                      </th>
                      <th scope="col" className="label-micro px-2 py-1.5 text-left text-fg-subtle">
                        DSA
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundle.press.cross_source_agreement.rows.map((row) => (
                      <tr key={row.field} className="border-b border-line-soft last:border-b-0">
                        <th scope="row" className="px-2 py-1.5 text-left text-[10px] font-semibold text-fg">
                          <span className="flex items-center gap-1">
                            {/* The disagreement is marked, not the agreement —
                                nine of eleven rows agree, and ticking all of
                                them would bury the two that do not. */}
                            {!row.agree && (
                              <span
                                aria-label="sources disagree"
                                className="size-1.5 flex-none rounded-full"
                                style={{ background: VERDICT_COLOR.wrong }}
                              />
                            )}
                            {row.field}
                          </span>
                        </th>
                        <td className="px-1 py-1.5 text-[9.5px] leading-snug text-fg-muted">{row.mod}</td>
                        <td className="px-1 py-1.5 text-[9.5px] leading-snug text-fg-muted">{row.csis}</td>
                        <td className="px-2 py-1.5 text-[9.5px] leading-snug text-fg-muted">{row.dsa}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-fg-muted">
                {bundle.press.cross_source_agreement.reading}
              </p>

              {bundle.press.editorial_claims_not_test_facts.length > 0 && (
                <>
                  <p className="label-micro mt-2.5 mb-1 text-fg-subtle">ANALYSIS, NOT OBSERVATION</p>
                  <ul className="flex flex-col gap-1.5">
                    {bundle.press.editorial_claims_not_test_facts.map((claim) => (
                      <li
                        key={claim.claim}
                        className="rounded-lg border border-status-inferred/25 bg-status-inferred/10 px-2.5 py-2"
                      >
                        <p className="text-[10.5px] leading-snug text-fg-muted">{claim.claim}</p>
                        <p className="mt-1 text-[9.5px] leading-snug text-fg-subtle">{claim.note}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Section>

            {/* ── Reporting after the fact ───────────────────────────────── */}
            <Section icon={MessageSquareQuote} title="REPORTING AFTER THE FACT">
              {!posts ? (
                <p className="flex items-center gap-2 text-[10.5px] text-fg-subtle">
                  <Spinner className="border-fg-subtle/30 border-t-fg-subtle" />
                  Loading the post-event sweep…
                </p>
              ) : (
                <>
                  <p className="mb-2 text-[10.5px] leading-snug text-fg-subtle">
                    {posts.data.summary.items_aoi_relevant} relevant posts across {posts.data.summary.story_clusters}{' '}
                    story clusters, {posts.data.summary.items_reporting_success} of them describing the trial as a
                    success. Volume is attention, not corroboration.
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {posts.data.aoi_relevant_items.slice(0, 8).map((post) => (
                      <li key={post.id} className="rounded-lg border border-line bg-inset p-2.5">
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noreferrer"
                          className="line-clamp-3 text-[10.5px] leading-snug text-fg hover:text-accent"
                        >
                          {post.title}
                        </a>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="rounded-[3px] bg-badge px-1 py-px text-[8px] font-bold text-badge-fg">
                            {post.platform.toUpperCase()}
                          </span>
                          <span className="numeric ml-auto text-[9.5px] text-fg-subtle">{stamp(post.published)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Section>

            {/* ── Withdrawn from scoring ─────────────────────────────────────
                The scorecard and the environment capture each record this
                withdrawal under their own key — `gnss_interference` and `gnss` —
                and they are the same decision written twice. Merging the two
                objects would list it as two findings, so the scorecard's keys
                lead and an entry from the environment capture is only added when
                nothing already covers it. */}
            {withdrawn.length > 0 && (
              <section>
                <FieldLabel>WITHDRAWN FROM SCORING</FieldLabel>
                <ul className="flex flex-col gap-1.5">
                  {withdrawn.map(([key, reason]) => (
                    <li key={key} className="rounded-lg border border-line bg-inset px-2.5 py-2">
                      <p className="label-micro text-fg-subtle">{key.replace(/_/g, ' ').toUpperCase()}</p>
                      <p className="mt-1 text-[10.5px] leading-relaxed text-fg-muted">{reason}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <footer className="border-t border-line pt-3 text-[10px] leading-relaxed text-fg-subtle">
              {bundle.adsb.bottom_line}
            </footer>
          </div>
        )}
      </aside>
    </>
  )
}
