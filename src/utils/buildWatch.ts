import { TYPE_CATEGORY } from '@/utils/constants'
import type { Cluster, FeedItem, Watch, WatchDetail, WatchDraft } from '@/types/monitoring'

/*
 * A keyword watch matching "karachi" used to import a bundled Urdu-language
 * Facebook/X export, landing a pinned cluster and six feed rows. That demo hook
 * has been removed along with its dataset: the dashboard is English-only and
 * reads from the API, so a new watch is created empty and the backend decides
 * what matches it.
 */

/** Everything a newly-saved watch contributes to the store, in one payload. */
export interface NewWatchEntities {
  watch: Watch
  /** Null until the backend reports matches — a new watch places no cluster. */
  cluster: Cluster | null
  detail: WatchDetail | null
  feedItems: FeedItem[]
}

const FALLBACK_WATCH_NAME = 'Untitled watch'

/** Non-deterministic inputs, supplied by the caller so this module stays pure. */
export interface BuildWatchOptions {
  /** Unique id for the new watch. */
  id: string
  /** Current time in ms. Used by the disabled import path above. */
  now: number
}

/**
 * Derive the entities a saved draft produces.
 *
 * The id and clock are parameters rather than `nanoid()` / `Date.now()` calls so
 * this stays pure and the reducer consuming it stays deterministic — both are
 * supplied by the action's `prepare` callback.
 */
export function buildWatchFromDraft(draft: WatchDraft, { id }: BuildWatchOptions): NewWatchEntities {
  const category = TYPE_CATEGORY[draft.type]
  const name = draft.name.trim() || FALLBACK_WATCH_NAME

  return {
    watch: { id, name, category, count: 0 },
    cluster: null,
    detail: null,
    feedItems: [],
  }
}
