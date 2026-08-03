import { useCallback, useEffect, useRef } from 'react'
import { env } from '@/utils/env'
import { loadSnapshot, refreshFeed } from '@/store/slices/monitoringSlice'
import { useAppDispatch } from '@/store/store'

/**
 * Keep the dashboard's data current.
 *
 * Loads a full snapshot once on mount, then re-fetches the activity feed every
 * `VITE_FEED_POLL_MS`. Polling stops while the tab is hidden and fires once
 * immediately on return, so a backgrounded dashboard neither burns requests nor
 * comes back showing an hour-old feed.
 *
 * Mounted once, by `MonitoringChrome`.
 */
export function useLivePoll(): void {
  const dispatch = useAppDispatch()

  useEffect(() => {
    const promise = dispatch(loadSnapshot())
    return () => promise.abort()
  }, [dispatch])

  useEffect(() => {
    let timer: number | undefined

    const stop = () => {
      window.clearInterval(timer)
      timer = undefined
    }

    const start = () => {
      if (timer !== undefined) return
      timer = window.setInterval(() => void dispatch(refreshFeed()), env.feedPollMs)
    }

    const handleVisibility = () => {
      if (document.hidden) {
        stop()
        return
      }
      void dispatch(refreshFeed())
      start()
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [dispatch])
}

/**
 * Manual feed refresh for the button in the activity rail.
 *
 * Returns a promise that settles when the request does, so the caller's spinner
 * reflects the real request rather than a fixed timeout.
 */
export function useManualRefresh(): () => Promise<void> {
  const dispatch = useAppDispatch()
  const inFlight = useRef(false)

  return useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      await dispatch(refreshFeed()).unwrap()
    } catch {
      // The slice already recorded the failure; the status pill surfaces it.
    } finally {
      inFlight.current = false
    }
  }, [dispatch])
}
