import { request, type RequestOptions } from '@/api/client'
import { SEED_CLUSTERS, SEED_DETAILS, SEED_FEED, SEED_WATCHES } from '@/data/seed'
import { SEED_POINTS } from '@/data/signals'
import { hasApi } from '@/utils/env'
import type { Cluster, FeedItem, MapPoint, SignalLayerId, Watch, WatchDetail } from '@/types/monitoring'

/**
 * Monitoring API endpoints.
 *
 * Each function returns live data once `VITE_API_BASE_URL` is set and the
 * bundled fixture corpus otherwise, so the dashboard is fully demoable without
 * a backend and no component needs to know which is in play.
 *
 * Failures from a *configured* API are not swallowed — they propagate so the
 * slice keeps the last good data on the map and the status pill can report the
 * source as unhealthy, rather than silently falling back to fixtures and
 * looking healthy while showing stale demo data.
 *
 * To add demo content, edit `src/data/seed.ts` (watches, clusters, feed, topic
 * detail) and `src/data/signals.ts` (signal-layer points). Nothing else needs
 * touching — it flows straight through to the map.
 */

/** Everything the map needs for a cold start, in one round trip. */
export interface MonitoringSnapshot {
  watches: Watch[]
  clusters: Cluster[]
  details: Record<string, WatchDetail>
  feed: FeedItem[]
}

const FIXTURE_SNAPSHOT: MonitoringSnapshot = {
  watches: SEED_WATCHES,
  clusters: SEED_CLUSTERS,
  details: SEED_DETAILS,
  feed: SEED_FEED,
}

export function fetchSnapshot(options?: RequestOptions): Promise<MonitoringSnapshot> {
  if (!hasApi()) return Promise.resolve(FIXTURE_SNAPSHOT)
  return request<MonitoringSnapshot>('/monitoring/snapshot', options)
}

export function fetchFeed(options?: RequestOptions): Promise<FeedItem[]> {
  if (!hasApi()) return Promise.resolve(SEED_FEED)
  return request<FeedItem[]>('/monitoring/feed', options)
}

export function fetchWatchDetail(watchId: string, options?: RequestOptions): Promise<WatchDetail | null> {
  if (!hasApi()) return Promise.resolve(SEED_DETAILS[watchId] ?? null)
  return request<WatchDetail | null>(`/monitoring/watches/${encodeURIComponent(watchId)}`, options)
}

/** Points for one signal layer. The backend may narrow by viewport later. */
export function fetchPoints(layerId: SignalLayerId, options?: RequestOptions): Promise<MapPoint[]> {
  if (!hasApi()) return Promise.resolve(SEED_POINTS[layerId] ?? [])
  return request<MapPoint[]>(`/monitoring/layers/${layerId}/points`, options)
}

// Place-name search lives in `./geocode.ts` — it has a second provider to fall
// back to, so it does not fit the one-function-per-endpoint shape above.
