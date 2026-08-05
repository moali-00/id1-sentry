import { flightStreamUrl, hasFlightApi } from '@/utils/env'
import type {
  FlightSnapshotMessage,
  FlightStreamMessage,
  FlightSubscription,
  FlightUpdateMessage,
} from '@/types/flights'

/**
 * Sentry Flight API — the live stream.
 *
 * One long-lived socket carrying a full snapshot on connect and field-level
 * deltas (~2 KB against a ~20 KB snapshot) every couple of seconds after. Written
 * as a plain controller with no React in it, because the map consumes it outside
 * the render cycle and a hook would tie its lifetime to a component's.
 *
 * A socket on a public network is *expected* to die — proxies idle it out, laptops
 * suspend, cell handoffs drop it. Everything below is about that: reconnect with
 * backoff, and a watchdog for the case that actually loses data, which is a socket
 * that is open as far as the browser knows but has silently stopped delivering.
 */

export type FlightStreamStatus = 'connecting' | 'open' | 'closed'

export interface FlightStreamHandlers {
  onSnapshot: (message: FlightSnapshotMessage) => void
  onUpdate: (message: FlightUpdateMessage) => void
  onStatus: (status: FlightStreamStatus) => void
}

export interface FlightStreamController {
  /** Re-scope the stream. The server answers with a fresh snapshot. */
  subscribe: (subscription: Omit<FlightSubscription, 'op'>) => void
  /**
   * Re-send the current subscription, bypassing the no-op check in `subscribe`.
   *
   * For when the *server's* state changed under a subscription that did not — the
   * tracked region being repointed, which clears every contact. Asking again is
   * how we get a snapshot of the new place instead of waiting for deltas to
   * rebuild it one aircraft at a time.
   */
  resubscribe: () => void
  /** Permanent teardown — no further reconnects. */
  close: () => void
}

/** Reconnect delays, ms. Repeats the last value once exhausted. */
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000]

/**
 * Silence that means the socket is dead.
 *
 * The server sends a ping every ~10s on top of ~2s updates, so 35s without any
 * message is not a quiet period — it is a connection that will never deliver
 * again, and the browser will happily hold it open forever. Without this the map
 * freezes and nothing reports a problem.
 */
const WATCHDOG_MS = 35_000

export function openFlightStream(handlers: FlightStreamHandlers): FlightStreamController {
  if (!hasFlightApi()) {
    handlers.onStatus('closed')
    return { subscribe: () => {}, resubscribe: () => {}, close: () => {} }
  }

  let socket: WebSocket | null = null
  let attempt = 0
  let disposed = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null

  /** Replayed on every reconnect, so the new socket resumes the same viewport. */
  let subscription: Omit<FlightSubscription, 'op'> = {}
  /** Serialised, to skip re-subscribing to the bbox we are already on. */
  let subscriptionKey = ''

  const clearTimers = () => {
    if (reconnectTimer !== null) clearTimeout(reconnectTimer)
    if (watchdogTimer !== null) clearTimeout(watchdogTimer)
    reconnectTimer = null
    watchdogTimer = null
  }

  const armWatchdog = () => {
    if (watchdogTimer !== null) clearTimeout(watchdogTimer)
    watchdogTimer = setTimeout(() => {
      if (disposed) return
      // Drop it and let `onclose` schedule the reconnect, so there is one path
      // back rather than two racing.
      socket?.close()
    }, WATCHDOG_MS)
  }

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer !== null) return

    const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]
    attempt += 1
    // Jitter so a proxy restart does not bring every open dashboard back in the
    // same millisecond.
    reconnectTimer = setTimeout(connect, delay + Math.floor(Math.random() * 400))
  }

  const send = (payload: FlightSubscription) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload))
  }

  function connect(): void {
    if (disposed) return

    clearTimers()
    handlers.onStatus('connecting')

    let next: WebSocket
    try {
      next = new WebSocket(flightStreamUrl())
    } catch {
      // A malformed URL or a blocked mixed-content upgrade throws synchronously.
      handlers.onStatus('closed')
      scheduleReconnect()
      return
    }
    socket = next

    next.addEventListener('open', () => {
      if (disposed) {
        next.close()
        return
      }
      attempt = 0
      handlers.onStatus('open')
      send({ op: 'sub', ...subscription })
      armWatchdog()
    })

    next.addEventListener('message', (event: MessageEvent<string>) => {
      if (disposed) return
      armWatchdog()

      let message: FlightStreamMessage
      try {
        message = JSON.parse(event.data) as FlightStreamMessage
      } catch {
        // One unparseable frame is not worth dropping the connection over.
        return
      }

      if (message.op === 'snapshot') handlers.onSnapshot(message)
      else if (message.op === 'upd') handlers.onUpdate(message)
      // `ping` needs no handling beyond the watchdog reset above.
    })

    next.addEventListener('close', () => {
      if (disposed || socket !== next) return
      socket = null
      handlers.onStatus('closed')
      scheduleReconnect()
    })

    // `error` is always followed by `close`, which owns the reconnect. Listening
    // only to keep an unhandled event off the console.
    next.addEventListener('error', () => {})
  }

  connect()

  return {
    subscribe: (nextSubscription) => {
      const key = JSON.stringify(nextSubscription)
      // Each `sub` costs a full snapshot, so a map settling onto a bbox it is
      // already watching must not pay for one.
      if (key === subscriptionKey) return

      subscription = nextSubscription
      subscriptionKey = key
      send({ op: 'sub', ...nextSubscription })
    },

    resubscribe: () => {
      send({ op: 'sub', ...subscription })
    },

    close: () => {
      disposed = true
      clearTimers()
      handlers.onStatus('closed')
      socket?.close()
      socket = null
    },
  }
}
