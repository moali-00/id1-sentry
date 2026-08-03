import { useCallback, useState } from 'react'
import type { WatchDraft } from '@/types/monitoring'

/** Keys whose value is a multi-select list of strings. */
type ListKey = 'platforms'

/**
 * Controlled state for the watch form.
 *
 * Keeping it here rather than as a dozen `useState` calls in the modal means the
 * component only describes layout, and the create and edit flows share one
 * update path.
 */
export function useWatchDraft(initial: WatchDraft) {
  const [draft, setDraft] = useState<WatchDraft>(initial)

  const update = useCallback(<K extends keyof WatchDraft>(key: K, value: WatchDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }, [])

  /** Add or remove one entry from a multi-select field. */
  const toggleInList = useCallback((key: ListKey, value: string) => {
    setDraft((current) => {
      const list = current[key]
      return {
        ...current,
        [key]: list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value],
      }
    })
  }, [])

  return { draft, update, toggleInList }
}
