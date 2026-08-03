import { useEffect, useRef } from 'react'
import { env, hasApi } from '@/utils/env'
import { loadItr, streamStatusChanged } from '@/store/slices/itrSlice'
import { useAppDispatch } from '@/store/store'

/**
 * Subscribe to the Sentiry event stream.
 *
 * `GET /v1/stream` is server-sent events — the capture's preamble is a bare
 * `: connected` comment, and `/v1/poller` reports the loops publishing into it
 * (aircraft every 180s, assessment every 900s). Rather than polling blindly on
 * our own timer, the dashboard refetches when the server says something moved.
 *
 * The stream carries no payload we depend on: an event is treated purely as
 * "state changed, go and read it". That keeps this working whatever event names
 * the backend settles on, and means a schema change upstream cannot silently
 * feed us a stale view.
 */

/**
 * Floor between refetches.
 *
 * The aircraft loop fires every 180s but several loops can publish at once, and
 * a burst must not turn into a burst of full snapshot reloads.
 */
const REFETCH_THROTTLE_MS = 15_000

/** Reconnect backoff. `EventSource` retries on its own, but not after an error. */
const RECONNECT_BASE_MS = 3_000
const RECONNECT_MAX_MS = 60_000

export function useSentiryStream(): void {
  const dispatch = useAppDispatch()
  const lastRefetch = useRef(0)

  useEffect(() => {
    // No API means the fixtures are in play, and there is nothing to stream.
    if (!hasApi()) return

    let source: EventSource | null = null
    let reconnectTimer: number | undefined
    let attempt = 0
    let closed = false

    const refetch = () => {
      const now = Date.now()
      if (now - lastRefetch.current < REFETCH_THROTTLE_MS) return
      lastRefetch.current = now
      void dispatch(loadItr())
    }

    const connect = () => {
      if (closed) return

      source = new EventSource(`${env.apiBaseUrl}/v1/stream`)

      source.onopen = () => {
        attempt = 0
        dispatch(streamStatusChanged('live'))
      }

      // Named events are not depended on — any traffic means "re-read".
      source.onmessage = refetch

      source.onerror = () => {
        dispatch(streamStatusChanged('reconnecting'))
        source?.close()
        source = null
        if (closed) return

        // Exponential backoff so a downed backend is not hammered.
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS)
        attempt += 1
        reconnectTimer = window.setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      closed = true
      window.clearTimeout(reconnectTimer)
      source?.close()
      dispatch(streamStatusChanged('off'))
    }
  }, [dispatch])
}
