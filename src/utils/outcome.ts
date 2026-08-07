import type { MapArea } from '@/types/monitoring'
import type { AirspaceExclusion, ClosedZone, NamedSystems, ScorecardCall } from '@/types/outcome'

/**
 * Adapters over the after-action captures.
 *
 * Same contract as `@/utils/sentiryAdapters.ts`: the capture stays verbatim and
 * these turn it into what a panel or the map can render, without throwing
 * anything away or inventing anything that was not measured.
 */

/* ── Scorecard verdicts ──────────────────────────────────────────────────── */

/**
 * How a call turned out, reduced to four states.
 *
 * The capture writes each outcome as prose beginning with the verdict — `WRONG,
 * and instructively so.` — rather than as a field, and that is the right way
 * round: the sentence is the finding and the token is a label for it. So the
 * token is recovered here for colour and counting, and the prose is rendered
 * untouched beside it.
 *
 * `consistent` is kept apart from `correct` because the capture is careful about
 * the difference and the UI must not flatten it: the launch fell inside the
 * declared window, but the announcement time is not the launch time, so that
 * call was corroborated rather than proven.
 */
export type VerdictKind = 'correct' | 'consistent' | 'wrong' | 'unproven'

const VERDICT_TOKENS: [prefix: string, kind: VerdictKind, label: string][] = [
  ['CORRECT', 'correct', 'CORRECT'],
  ['CONSISTENT', 'consistent', 'CONSISTENT'],
  ['WRONG', 'wrong', 'WRONG'],
  ['NOT DEMONSTRATED', 'unproven', 'NOT DEMONSTRATED'],
  ['NOT YET', 'unproven', 'NOT YET'],
]

export interface Verdict {
  kind: VerdictKind
  /** The token as the capture wrote it — `NOT DEMONSTRATED`, not `UNPROVEN`. */
  label: string
  /** Everything after the token, with the leading dash or full stop removed. */
  prose: string
}

export function outcomeVerdict(call: ScorecardCall): Verdict {
  const match = VERDICT_TOKENS.find(([prefix]) => call.outcome.startsWith(prefix))
  if (!match) return { kind: 'unproven', label: 'UNSCORED', prose: call.outcome }

  const [prefix, kind, label] = match
  // The separator is one of `—`, `.` or `,` depending on the entry; strip
  // whichever it is along with the space after it.
  const prose = call.outcome.slice(prefix.length).replace(/^[\s—.,-]+/, '')
  return { kind, label, prose }
}

/**
 * Verdict → one of the fixed status hues.
 *
 * Reserved colours used as status, which is what they are for. Written as raw
 * hex rather than `var(--color-status-*)` for the same reason `LEVEL_COLOR` in
 * `@/utils/levels.ts` is: these are consumed as *values*, composed into
 * `color-mix()` fills and `${color}55` borders, and a `var()` reference cannot
 * take an alpha suffix — `var(--color-status-observed)55` is not a colour, it is
 * a declaration the browser drops silently.
 *
 * The values below mirror `--color-status-*` and `--color-risk-medium` in
 * `index.css`, which are fixed across both palettes, so there is nothing here
 * for a theme to disagree with.
 */
export const VERDICT_COLOR: Record<VerdictKind, string> = {
  correct: '#05df72', // status-observed
  // Corroborated but not proven is exactly what the amber "inferred" step means
  // everywhere else in this dashboard.
  consistent: '#fbbf24', // status-inferred
  wrong: '#ff6467', // status-missing
  // Grey, deliberately: an indicator that could not see the event is neither a
  // hit nor a miss, and the risk ramp already reserves this step for that reading.
  unproven: '#90a1b9', // risk-medium
}

export interface VerdictTally {
  correct: number
  consistent: number
  wrong: number
  unproven: number
  total: number
}

export function tallyCalls(calls: ScorecardCall[]): VerdictTally {
  const tally: VerdictTally = { correct: 0, consistent: 0, wrong: 0, unproven: 0, total: calls.length }
  for (const call of calls) tally[outcomeVerdict(call).kind] += 1
  return tally
}

/* ── The social reversal ─────────────────────────────────────────────────── */

export interface ReversalRow {
  system: string
  before: number
  after: number
  /** `after - before`. The whole point of the chart. */
  delta: number
}

/**
 * Named-system mention counts, before and after, as one row per system.
 *
 * Union of both corpora rather than either one: a system named 21 times before
 * and twice after has to keep its row, because its collapse is the finding.
 * Sorted by the after count so the system that was actually fired leads, with
 * the pre-event favourites falling down the list beneath it — which is the
 * reversal, drawn as an ordering.
 */
export function reversalRows(before: NamedSystems, after: NamedSystems): ReversalRow[] {
  const systems = new Set([...Object.keys(before), ...Object.keys(after)])

  return [...systems]
    .map((system) => {
      const wasNamed = before[system] ?? 0
      const isNamed = after[system] ?? 0
      return { system, before: wasNamed, after: isNamed, delta: isNamed - wasNamed }
    })
    .sort((a, b) => b.after - a.after || b.before - a.before)
}

/* ── The airspace exclusion test ─────────────────────────────────────────── */

export interface TrafficDay {
  date: string
  count: number
  /** 06 August — the day the trial actually flew. Drawn at full strength. */
  isLaunchDay: boolean
}

/**
 * One side of the traffic comparison as a dated series.
 *
 * `inside` and `outside` are returned separately and are meant to be drawn as
 * two charts, never two lines on one: they differ by a factor of six (≈279
 * against ≈1,599 aircraft a day), and putting them on a shared axis would flatten
 * the inside series into a floor and invent a relationship between them.
 */
export function trafficSeries(
  exclusion: AirspaceExclusion,
  side: 'inside' | 'outside',
  /** ISO date of the trial, from ground truth rather than assumed here. */
  launchDate: string,
): TrafficDay[] {
  return Object.entries(exclusion.daily_traffic)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, count: counts[side], isLaunchDay: date === launchDate }))
}

/* ── Closed-zone geometry ────────────────────────────────────────────────── */

/** GeoJSON winding — `[lon, lat]`, which is also what MapLibre wants. */
type Ring = [number, number][]

/**
 * The one closed zone worth adding to the map.
 *
 * Only the airspace circle. The register's six maritime zones are the same
 * warnings `/v1/maritime/warnings` already plots, and drawing a second, later
 * copy of a polygon over the first would read as two danger areas where there is
 * one.
 *
 * VED-52 is different, and it is the whole reason this layer exists. The NOTAM
 * publishes a centre and a 35 NM radius; the pre-event capture stored that as a
 * four-point **bounding box**, which is 139 × 130 km around a circle 130 km
 * across — and the corners it adds are enough to wrongly enclose Abdul Kalam
 * Island. Drawn here from the 24 published bearings instead, so the true circle
 * and the stored box can be seen on top of each other. The island falls outside
 * the circle by 10.6 km; Chandipur, which the MoD named as the launch site,
 * falls inside it by 11.0 km.
 */
export function closureAreas(zones: ClosedZone[]): MapArea[] {
  return zones.flatMap((zone) => {
    const ring = zone.boundary_ring_24pt
    if (!ring || ring.length < 3) return []

    const island = zone.containment?.find((place) => !place.inside)
    const detail = [
      zone.radius ? `${zone.radius.nm} NM radius from ${zone.centre?.as_published ?? 'the published centre'}` : null,
      zone.vertical_limits ? `${zone.vertical_limits.lower} to ${zone.vertical_limits.upper}` : null,
      island ? `${island.place} is ${island.margin_km} km outside it` : null,
    ]
      .filter(Boolean)
      .join(' · ')

    return [
      {
        id: `closure-${zone.zone}`,
        layerId: 'itr_closure' as const,
        ring: ring.map((point) => [point.lon, point.lat] as [number, number]),
        label: `${zone.zone} · verified circle`,
        detail,
        // Solid, not dashed. Every other approximated shape on this map is drawn
        // dashed because its boundary is inferred — this one is the opposite
        // case: it is the *published* geometry, correcting an approximation that
        // is already on screen.
        emphasis: 1,
      },
    ]
  })
}

/**
 * Every ring a zone publishes, for the register list's own geometry counts.
 *
 * Separate from `closureAreas` because the register describes eight zones and
 * only one of them reaches the map — the panel still has to say how many
 * vertices each of the other seven declared.
 */
export function zoneRings(zone: ClosedZone): Ring[] {
  const toRing = (points: { lat: number; lon: number }[]): Ring => points.map((point) => [point.lon, point.lat])

  if (zone.boundary_ring_24pt) return [toRing(zone.boundary_ring_24pt)]
  if (zone.area_A || zone.area_B) return [zone.area_A, zone.area_B].filter(Boolean).map((area) => toRing(area!))
  if (zone.vertices) return [toRing(zone.vertices)]
  if (zone.corners) return [toRing(zone.corners)]
  return []
}

export const zoneVertexCount = (zone: ClosedZone): number =>
  zoneRings(zone).reduce((total, ring) => total + ring.length, 0)
