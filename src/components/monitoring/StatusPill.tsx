import { useSyncExternalStore } from 'react'
import { Moon, Radio, Sun } from 'lucide-react'
import { cn } from '@/utils/cn'
import { env } from '@/utils/env'
import { relativeTime } from '@/utils/format'
import { Panel } from '@/components/ui/Panel'
import { IconButton } from '@/components/ui/IconButton'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { selectLastFetchedAt, selectStatus } from '@/store/slices/monitoringSlice'
import { selectStreamStatus } from '@/store/slices/itrSlice'
import { selectLayerEnabled } from '@/store/slices/layersSlice'
import {
  selectFlightCount,
  selectFlightRegion,
  selectFlightStreamStatus,
  selectFlightsDegraded,
} from '@/store/slices/flightsSlice'
import { selectTheme, toggleTheme } from '@/store/slices/themeSlice'
import { hasFlightApi } from '@/utils/env'

/** A feed older than this reads as stale rather than live. */
const STALE_AFTER_MS = 3 * 60_000

/** Clock resolution. Both the displayed time and staleness are minute-scale. */
const TICK_MS = 30_000

const subscribeToClock = (onChange: () => void) => {
  const timer = window.setInterval(onChange, TICK_MS)
  return () => window.clearInterval(timer)
}

/**
 * Bucketed so the snapshot is stable between ticks — `useSyncExternalStore`
 * would loop on a raw `Date.now()`.
 */
const clockSnapshot = () => Math.floor(Date.now() / TICK_MS)

/** Wall-clock time, rounded to `TICK_MS`, as a re-rendering value. */
function useNow(): number {
  return useSyncExternalStore(subscribeToClock, clockSnapshot) * TICK_MS
}

function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

/**
 * Top-centre status pill: product name, source health and the theme toggle.
 *
 * The indicator reports the state of the upstream feed rather than being
 * decoratively green — an operator has to be able to tell a quiet map from a
 * broken one.
 */
export function StatusPill({ onHealthClick }: { onHealthClick?: () => void }) {
  const dispatch = useAppDispatch()
  const theme = useAppSelector(selectTheme)
  const status = useAppSelector(selectStatus)
  const lastFetchedAt = useAppSelector(selectLastFetchedAt)
  const stream = useAppSelector(selectStreamStatus)
  const aircraftOn = useAppSelector(selectLayerEnabled).itr_aircraft
  const flightStream = useAppSelector(selectFlightStreamStatus)
  const flightDegraded = useAppSelector(selectFlightsDegraded)
  const flightCount = useAppSelector(selectFlightCount)
  const flightRegion = useAppSelector(selectFlightRegion)
  const now = useNow()
  const clock = formatClock(now)

  /**
   * ADS-B health, shown only while the layer is on.
   *
   * `degraded` outranks the socket being up, and that ordering is the point: a
   * healthy connection delivering frozen positions is the failure the API guide
   * warns about, because it is the one that looks fine. An operator must not read
   * a stationary aircraft as an aircraft that is holding.
   */
  const traffic =
    !aircraftOn || !hasFlightApi()
      ? null
      : flightDegraded
        ? { dot: 'bg-status-inferred', label: 'ADS-B STALE', title: 'Upstream ADS-B sources are failing — positions are frozen' }
        : flightStream === 'open'
          ? {
              dot: 'animate-pulse-live bg-status-observed',
              label: `ADS-B · ${flightCount}`,
              // The region is named because the backend tracks one shared area that
              // any caller can repoint. If it ever reads as somewhere other than the
              // island, that is the explanation for an empty layer.
              title: flightRegion
                ? `${flightCount} aircraft within ${Math.round(flightRegion.radius_km)} km of ${flightRegion.name}, updating every ~2s`
                : `${flightCount} aircraft tracked, updating every ~2s`,
            }
          : {
              dot: 'bg-status-inferred',
              label: 'ADS-B ↻',
              title: 'Reconnecting to the flight stream',
            }

  // Seconds-since-epoch of the last refresh, but only once it counts as stale.
  const staleSince =
    lastFetchedAt !== null && now - lastFetchedAt > STALE_AFTER_MS ? Math.floor(lastFetchedAt / 1000) : null

  const health =
    status === 'error'
      ? // Deliberately not the underlying failure message — it is a transport
        // error, and it tells the reader nothing about the target.
        { dot: 'bg-status-missing', label: 'NO FEED', title: 'Nothing is reporting on this target' }
      : staleSince !== null
        ? {
            dot: 'bg-status-inferred',
            label: `STALE · ${relativeTime(staleSince, now)}`,
            title: 'The last successful refresh is ageing out',
          }
        : { dot: 'bg-status-live animate-pulse-live', label: `LIVE · ${clock}Z`, title: 'Feed is current' }

  return (
    <Panel className="animate-rise absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded-full py-2 pr-2 pl-3.5">
      <Radio className="size-3.5 text-accent" aria-hidden />
      <span className="text-xs font-bold tracking-[0.04em] text-fg">{env.title}</span>

      <span className="h-3.5 w-px bg-line" aria-hidden />

      <button
        type="button"
        onClick={onHealthClick}
        title={`${health.title} — click for collection status`}
        className="flex items-center gap-2 rounded-full px-1 py-0.5 transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        <span className={cn('inline-block size-2 rounded-full', health.dot)} aria-hidden />
        <span className="text-[11px] font-semibold text-fg-muted">{health.label}</span>
      </button>

      {/* Only shown once a backend is actually streaming — against fixtures the
          stream is `off` and claiming "live" would be a lie. */}
      {stream !== 'off' && (
        <>
          <span className="h-3.5 w-px bg-line" aria-hidden />
          <span
            title={stream === 'live' ? 'Subscribed to the event stream' : 'Stream dropped — reconnecting'}
            className="flex items-center gap-1.5"
          >
            <span
              aria-hidden
              className={cn(
                'inline-block size-1.5 rounded-full',
                stream === 'live' ? 'animate-pulse-live bg-status-observed' : 'bg-status-inferred',
              )}
            />
            <span className="label-micro text-fg-subtle">{stream === 'live' ? 'STREAM' : 'RECONNECT'}</span>
          </span>
        </>
      )}

      {traffic && (
        <>
          <span className="h-3.5 w-px bg-line" aria-hidden />
          <span title={traffic.title} className="flex items-center gap-1.5">
            <span aria-hidden className={cn('inline-block size-1.5 rounded-full', traffic.dot)} />
            <span className="label-micro text-fg-subtle">{traffic.label}</span>
          </span>
        </>
      )}

      <IconButton
        title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        onClick={() => dispatch(toggleTheme())}
        className="rounded-full"
      >
        {theme === 'light' ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
      </IconButton>
    </Panel>
  )
}
