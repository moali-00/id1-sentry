import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Plane, X } from 'lucide-react'
import { fetchAircraftDetail } from '@/api/flights'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { selectFlight, selectFlightsByHex } from '@/store/slices/flightsSlice'
import { FieldLabel } from '@/components/ui/FieldLabel'
import { IconButton } from '@/components/ui/IconButton'
import {
  BAND_COLOR,
  aircraftModel,
  aircraftTitle,
  altitudeBand,
  altitudeLabel,
  isStale,
  speedLabel,
  verticalRateLabel,
} from '@/utils/flights'
import type { FlightAircraft } from '@/types/flights'

/**
 * One aircraft's dossier, opened as a nested route (`/aircraft/:hex`).
 *
 * Live: the aircraft is read from the flight store, so altitude, speed and
 * vertical rate tick over while the panel is open rather than freezing at the
 * values that were true when it was clicked.
 *
 * Two things it deliberately does not do. It never renders an empty frame for a
 * missing enrichment block — a photo, a route and an operator each resolve for
 * roughly half of contacts, and a labelled blank asserts that something is wrong
 * when in fact nothing was ever published. And it does not treat the aircraft
 * leaving the region as an error: that happens constantly, and the panel simply
 * closes.
 */

/** A stat cell. Anything the transponder did not report reads as an em dash. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-inset px-2.5 py-2">
      <p className="numeric text-[13px] font-bold text-fg">{value}</p>
      <p className="mt-0.5 text-[10px] text-fg-muted">{label}</p>
    </div>
  )
}

/** One end of a route. */
function Endpoint({ label, airport }: { label: string; airport: NonNullable<FlightAircraft['route']>['origin'] }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="label-micro text-fg-subtle">{label}</p>
      <p className="numeric text-[15px] font-bold text-fg">{airport?.iata ?? airport?.icao ?? '???'}</p>
      {airport?.city && <p className="truncate text-[11px] text-fg-muted">{airport.city}</p>}
    </div>
  )
}

export default function AircraftDetailPage() {
  const { hex } = useParams<{ hex: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const byHex = useAppSelector(selectFlightsByHex)

  /**
   * A cold deep link arrives before the stream's first snapshot, and the socket
   * only ever carries the current viewport — an aircraft outside it is absent from
   * the store but perfectly real. So a one-shot REST fetch backs the panel up, and
   * `null` from it means genuinely not tracked.
   */
  const [fetched, setFetched] = useState<FlightAircraft | null | undefined>(undefined)

  const streamed = hex ? byHex[hex] : undefined
  // Prefer the streamed record: it is the one that keeps ticking.
  const aircraft = streamed ?? fetched ?? null

  const close = useCallback(() => {
    dispatch(selectFlight(null))
    void navigate('/')
  }, [dispatch, navigate])

  useEscapeKey(close)

  // Keep the map's selection ring in step with whichever panel is open, including
  // on a deep link where nothing was ever clicked.
  useEffect(() => {
    if (hex) dispatch(selectFlight(hex))
    return () => {
      dispatch(selectFlight(null))
    }
  }, [dispatch, hex])

  useEffect(() => {
    if (!hex || streamed) return

    const controller = new AbortController()
    void fetchAircraftDetail(hex, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setFetched(result)
      })
      .catch(() => {
        // Network failure is not "not tracked" — leave it undefined so the panel
        // waits rather than redirecting away from a link that may be fine.
      })

    return () => controller.abort()
  }, [hex, streamed])

  if (!hex) return <Navigate to="/" replace />

  // Redirect only once the fetch has actually come back 404 — that is the one
  // answer meaning "not tracked". While it is still in flight, render nothing and
  // wait: bouncing early would make every shared `/aircraft/:hex` link useless,
  // which is the bug `/target` still has.
  if (!aircraft) return fetched === null ? <Navigate to="/" replace /> : null

  const model = aircraftModel(aircraft)
  const band = altitudeBand(aircraft)
  const route = aircraft.route
  const photo = aircraft.photo
  const stale = isStale(aircraft)

  return (
    <>
      <button
        type="button"
        onClick={close}
        aria-label="Close aircraft dossier"
        className="pointer-events-auto absolute inset-0 z-[1001] cursor-default bg-scrim"
      />

      <aside
        aria-label={`${aircraftTitle(aircraft)} dossier`}
        className="scroll-thin pointer-events-auto absolute inset-y-0 right-0 z-[1002] w-[420px] max-w-full overflow-y-auto border-l border-line bg-surface shadow-[-8px_0_24px_rgba(0,0,0,.28)]"
      >
        <div className="flex flex-col gap-3.5 p-4">
          <header className="flex items-center gap-2.5 border-b border-line pb-3">
            <span
              aria-hidden
              className="grid size-7 flex-none place-items-center rounded-md"
              style={{ background: `${BAND_COLOR[band]}22`, border: `1px solid ${BAND_COLOR[band]}55` }}
            >
              <Plane className="size-3.5" style={{ color: BAND_COLOR[band] }} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-bold text-fg">{aircraftTitle(aircraft)}</h2>
              <p className="truncate text-[11px] text-fg-muted">
                {[model, aircraft.aircraft?.operator].filter(Boolean).join(' · ') || 'Unidentified contact'}
              </p>
            </div>
            <IconButton size="md" title="Close aircraft dossier" onClick={close}>
              <X className="size-4" aria-hidden />
            </IconButton>
          </header>

          {stale && (
            <p className="rounded-md border border-status-inferred/30 bg-status-inferred/10 px-2.5 py-2 text-[11px] text-fg">
              This aircraft has not reported a position in over 30 seconds. It is drawn where it was last seen, not
              where it is.
            </p>
          )}

          {/*
            The photo is the one element that makes an aircraft concrete rather
            than a code. Rendered only when one exists — planespotters covers most
            airliners and almost no light aircraft — and always with its credit,
            which is a licensing condition rather than a courtesy.
          */}
          {photo?.large && (
            <figure className="overflow-hidden rounded-lg border border-line bg-inset">
              <img
                src={photo.large}
                alt={`${aircraftTitle(aircraft)} — ${model ?? 'aircraft'}`}
                className="block h-auto w-full"
                loading="lazy"
              />
              {photo.credit && (
                <figcaption className="px-2.5 py-1.5 text-[10px] text-fg-subtle">
                  Photo: {photo.credit}
                  {photo.source && ` · ${photo.source}`}
                </figcaption>
              )}
            </figure>
          )}

          {(route?.origin || route?.destination) && (
            <section>
              <FieldLabel>ROUTE</FieldLabel>
              <div className="flex items-start gap-2 rounded-lg border border-line bg-inset px-3 py-2.5">
                <Endpoint label="FROM" airport={route.origin} />
                <span aria-hidden className="pt-3 text-fg-subtle">
                  →
                </span>
                <Endpoint label="TO" airport={route.destination} />
              </div>
              {route.airline?.name && <p className="mt-1.5 text-[11px] text-fg-muted">{route.airline.name}</p>}
            </section>
          )}

          <section>
            <FieldLabel>POSITION</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Altitude" value={altitudeLabel(aircraft)} />
              <Stat label="Ground speed" value={speedLabel(aircraft)} />
              <Stat label="Vertical" value={verticalRateLabel(aircraft)} />
              <Stat label="Track" value={aircraft.track == null ? '—' : `${Math.round(aircraft.track)}°`} />
              <Stat label="From island" value={`${Math.round(aircraft.dist_km)} km`} />
              <Stat label="Bearing" value={`${Math.round(aircraft.bearing)}°`} />
            </div>
            <p className="mt-1.5 numeric text-[11px] text-fg-muted">
              {aircraft.lat.toFixed(4)}, {aircraft.lon.toFixed(4)}
            </p>
          </section>

          <section>
            <FieldLabel>TRANSPONDER</FieldLabel>
            <dl className="flex flex-col gap-1.5 text-[11px]">
              {[
                ['ICAO24', aircraft.hex.toUpperCase()],
                ['Registration', aircraft.registration ?? aircraft.aircraft?.registration],
                ['Type', aircraft.aircraft?.icao_type],
                ['Squawk', aircraft.squawk],
                // "none" is the normal state and says nothing worth a row.
                ['Emergency', aircraft.emergency && aircraft.emergency !== 'none' ? aircraft.emergency : null],
                ['Position source', aircraft.pos_type],
                ['Source', aircraft.src],
              ]
                .filter(([, value]) => Boolean(value))
                .map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3">
                    <dt className="text-fg-subtle">{label}</dt>
                    <dd className="numeric truncate font-semibold text-fg">{value}</dd>
                  </div>
                ))}
            </dl>
          </section>

          {(aircraft.wind_speed != null || aircraft.oat != null) && (
            <section>
              <FieldLabel>REPORTED BY THE AIRFRAME</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                {aircraft.wind_dir != null && <Stat label="Wind dir" value={`${aircraft.wind_dir}°`} />}
                {aircraft.wind_speed != null && <Stat label="Wind" value={`${aircraft.wind_speed} kt`} />}
                {aircraft.oat != null && <Stat label="Air temp" value={`${aircraft.oat}°C`} />}
              </div>
            </section>
          )}
        </div>
      </aside>
    </>
  )
}
