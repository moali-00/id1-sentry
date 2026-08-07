import { useEffect } from 'react'
import { loadOutcome } from '@/store/slices/outcomeSlice'
import { useAppDispatch } from '@/store/store'

/**
 * Load the after-action review's core captures once on mount.
 *
 * Eager, for the same reason `useItrData` is: two things visible before anyone
 * clicks anything read it. The resolution banner over the map states what
 * actually happened, and the verified-closure layer draws a correction to a
 * shape the danger-area layer is already drawing — a correction that arrived
 * late would show as the map redrawing itself under the operator.
 *
 * The thunk is one-shot (see `loadOutcome`), so remounting the map is free. The
 * post-event social sweep is *not* fetched here — the review panel asks for that
 * itself.
 */
export function useOutcomeData(): void {
  const dispatch = useAppDispatch()

  useEffect(() => {
    void dispatch(loadOutcome())
  }, [dispatch])
}
