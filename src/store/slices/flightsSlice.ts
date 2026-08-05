import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { FlightStreamStatus } from '@/api/flightStream'
import type {
  FlightAircraft,
  FlightAttribution,
  FlightRegion,
  FlightSnapshotMessage,
  FlightUpdateMessage,
} from '@/types/flights'

/**
 * Live ADS-B contacts from the flight stream.
 *
 * Its own slice rather than part of `itrSlice` because it is the one feed that is
 * genuinely streaming: everything there arrives as a whole document on a poll,
 * whereas this is patched field-by-field twice a second and has a connection with
 * a lifecycle attached.
 *
 * **Keyed by `hex`, never by callsign.** The ICAO24 transponder address is
 * permanent; callsigns and squawks change mid-flight. Anything keyed on a callsign
 * would silently split one aircraft into two.
 *
 * The 60 fps interpolation does *not* read through a subscription — it reads this
 * state imperatively from inside an animation frame (see `AircraftLayer`). This
 * slice therefore updates at the stream's ~2 s cadence, not at frame rate.
 */

/** The receipt bookkeeping interpolation needs, kept beside each contact. */
interface FlightTiming {
  /**
   * `performance.now()` when the fix arrived locally.
   *
   * A monotonic local clock on purpose: elapsed time is measured against this
   * rather than against `Date.now() - fix_ts`, which would fold client/server
   * clock skew straight into the projected position.
   */
  receivedAt: number
  /**
   * How old the fix already was on arrival, ms.
   *
   * Added to local elapsed time so an aircraft is drawn where it is *now*, not
   * where it was when the server flushed the frame — that lag is a second or two
   * at ~500 knots, which is a few hundred metres.
   */
  ageAtReceipt: number
}

interface FlightsState {
  byHex: Record<string, FlightAircraft>
  timing: Record<string, FlightTiming>
  region: FlightRegion | null
  /**
   * Upstream sources from the envelope.
   *
   * Held but deliberately not rendered — the sources panel was removed by
   * request. Kept because the upstream licences do require credit somewhere (§9
   * of the API guide), so whatever surfaces it later should read the API's own
   * list rather than hardcode one that can drift.
   */
  attribution: FlightAttribution[]
  /** True when every upstream is failing — positions are frozen, say so. */
  degraded: boolean
  status: FlightStreamStatus
  /** Server time of the last frame, unix ms. */
  generatedAt: number | null
  selectedHex: string | null
  hoveredHex: string | null
}

const initialState: FlightsState = {
  byHex: {},
  timing: {},
  region: null,
  attribution: [],
  degraded: false,
  status: 'connecting',
  generatedAt: null,
  selectedHex: null,
  hoveredHex: null,
}

/** A delta must have a position before it can become a new contact. */
const isPlottable = (candidate: Partial<FlightAircraft>): candidate is FlightAircraft =>
  typeof candidate.lat === 'number' && typeof candidate.lon === 'number' && typeof candidate.hex === 'string'

const flightsSlice = createSlice({
  name: 'flights',
  initialState,

  reducers: {
    /**
     * Replace the entire contact set.
     *
     * Sent on connect and after every re-subscribe, and authoritative: aircraft
     * absent from a snapshot are outside the new viewport and must go, or a pan
     * would leave a trail of abandoned markers behind it.
     */
    applySnapshot: {
      reducer(state, action: PayloadAction<{ message: FlightSnapshotMessage; receivedAt: number }>) {
        const { message, receivedAt } = action.payload

        state.byHex = {}
        state.timing = {}
        for (const aircraft of message.ac) {
          state.byHex[aircraft.hex] = aircraft
          state.timing[aircraft.hex] = { receivedAt, ageAtReceipt: aircraft.age_ms ?? 0 }
        }

        state.region = message.region
        state.attribution = message.attribution
        state.degraded = message.degraded
        state.generatedAt = message.generated_at
      },
      // `performance.now()` is a side effect, so it is read in `prepare` and the
      // reducer stays a pure function of (state, action) — same shape as
      // `createWatch` in `monitoringSlice`.
      prepare(message: FlightSnapshotMessage) {
        return { payload: { message, receivedAt: performance.now() } }
      },
    },

    /** Patch changed fields; add unseen contacts; drop removed ones. */
    applyUpdate: {
      reducer(state, action: PayloadAction<{ message: FlightUpdateMessage; receivedAt: number }>) {
        const { message, receivedAt } = action.payload

        for (const delta of message.ac) {
          const existing = state.byHex[delta.hex]

          if (existing) {
            // Two frames sharing a `fix_ts` are the same fix repeated. Patching it
            // again would reset the interpolation clock and make the aircraft
            // stutter backwards to where it already was.
            if (delta.fix_ts !== undefined && delta.fix_ts === existing.fix_ts) {
              Object.assign(existing, delta)
              continue
            }

            Object.assign(existing, delta)
            state.timing[delta.hex] = { receivedAt, ageAtReceipt: delta.age_ms ?? 0 }
            continue
          }

          // An unseen hex is an aircraft that just entered and carries a full
          // record — unless it does not, in which case there is nothing to draw.
          if (!isPlottable(delta)) continue
          state.byHex[delta.hex] = delta
          state.timing[delta.hex] = { receivedAt, ageAtReceipt: delta.age_ms ?? 0 }
        }

        for (const hex of message.removed) {
          delete state.byHex[hex]
          delete state.timing[hex]
        }

        state.degraded = message.degraded
        state.generatedAt = message.generated_at
      },
      prepare(message: FlightUpdateMessage) {
        return { payload: { message, receivedAt: performance.now() } }
      },
    },

    setStreamStatus(state, action: PayloadAction<FlightStreamStatus>) {
      state.status = action.payload
    },

    selectFlight(state, action: PayloadAction<string | null>) {
      state.selectedHex = action.payload
    },

    hoverFlight(state, action: PayloadAction<string | null>) {
      state.hoveredHex = action.payload
    },
  },

  selectors: {
    selectFlightsByHex: (state) => state.byHex,
    selectFlightTiming: (state) => state.timing,
    selectFlightRegion: (state) => state.region,
    selectFlightAttribution: (state) => state.attribution,
    selectFlightsDegraded: (state) => state.degraded,
    selectFlightStreamStatus: (state) => state.status,
    selectFlightsGeneratedAt: (state) => state.generatedAt,
    selectSelectedFlightHex: (state) => state.selectedHex,
    selectHoveredFlightHex: (state) => state.hoveredHex,
  },
})

export const { applySnapshot, applyUpdate, setStreamStatus, selectFlight, hoverFlight } = flightsSlice.actions

export const {
  selectFlightsByHex,
  selectFlightTiming,
  selectFlightRegion,
  selectFlightAttribution,
  selectFlightsDegraded,
  selectFlightStreamStatus,
  selectFlightsGeneratedAt,
  selectSelectedFlightHex,
  selectHoveredFlightHex,
} = flightsSlice.selectors

/** Contacts nearest the island first — the order the API itself uses. */
export const selectFlightList = createSelector([selectFlightsByHex], (byHex) =>
  Object.values(byHex).sort((a, b) => a.dist_km - b.dist_km),
)

export const selectFlightCount = createSelector([selectFlightsByHex], (byHex) => Object.keys(byHex).length)

/** The aircraft behind an open detail panel, or null once it leaves the region. */
export const selectSelectedFlight = createSelector(
  [selectFlightsByHex, selectSelectedFlightHex],
  (byHex, hex): FlightAircraft | null => (hex ? (byHex[hex] ?? null) : null),
)

export default flightsSlice.reducer
