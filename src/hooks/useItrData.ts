import { useEffect } from 'react'
import { loadItr } from '@/store/slices/itrSlice'
import { useAppDispatch } from '@/store/store'
import { useSentiryStream } from '@/hooks/useSentiryStream'

/**
 * Load the ITR target's feeds once on mount.
 *
 * Eager rather than lazy, unlike the generic signal layers: this target is the
 * subject of the dashboard, several of its feeds have no map geometry at all
 * (assessment, launch windows, source health) and the panels showing them are
 * visible immediately.
 */
export function useItrData(): void {
  const dispatch = useAppDispatch()

  // Live updates when a backend is configured; a no-op against fixtures.
  useSentiryStream()

  useEffect(() => {
    const promise = dispatch(loadItr())
    return () => promise.abort()
  }, [dispatch])
}
