import { DATE_RANGES, DEFAULT_PLATFORMS } from '@/utils/constants'
import type { Watch, WatchDraft } from '@/types/monitoring'

/** A blank draft for the create flow. */
export function createDraft(): WatchDraft {
  return {
    name: '',
    type: 'keyword',
    match: '',
    hasRegion: false,
    platforms: [...DEFAULT_PLATFORMS],
    dateRange: DATE_RANGES[0],
  }
}

/**
 * A draft seeded from an existing watch.
 *
 * Only name and category round-trip today — the seed dataset does not record
 * how each watch was originally matched, so the form opens on `region` with a
 * drawn area rather than inventing a match term.
 */
export function draftFromWatch(watch: Watch): WatchDraft {
  return { ...createDraft(), name: watch.name, type: 'region', hasRegion: true }
}
