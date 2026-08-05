/**
 * Talking to the upstream camera authorities.
 *
 * ## Why this identifies itself
 *
 * The reference implementation this feature was ported from rotated ten browser
 * user agents and forged `X-Forwarded-For` / `Client-IP` headers from a pool of
 * residential ISP subnets, so each request appeared to come from a different
 * home connection. That is deliberate evasion of rate limiting on public-sector
 * endpoints, and it is also self-defeating: the failure mode it invites is our
 * deployment IP being blocked by the exact agencies this layer depends on.
 *
 * So requests carry one honest user agent naming the product and a contact URL,
 * and the volume is kept down by caching instead. If an authority decides it does
 * not want our traffic, we would rather be told than find out by degrees.
 *
 * ## Why there is a cache here at all
 *
 * A camera *registry* is near-static — positions and names change monthly, not by
 * the second. Only the frames are live, and those go through `cctv-frame`. Every
 * registry fetch is therefore memoised per serverless instance, which is what
 * turns twenty-odd upstream calls per page load into twenty-odd per hour.
 */

const USER_AGENT = 'SentryDashboard/0.1 (+https://github.com/msiddique/id1x-sentry) camera-registry'

/** Upstream registries are given this long to answer before being abandoned. */
const DEFAULT_TIMEOUT_MS = 10_000

/**
 * How long a source's camera list is reused.
 *
 * An hour. Long enough that a warm instance serves most requests from memory,
 * short enough that a camera taken out of service disappears the same day.
 */
const CACHE_TTL_MS = 60 * 60 * 1000

export async function upstreamFetch(
  url: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS, headers }: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<Response> {
  return fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json, text/plain;q=0.9, */*;q=0.5',
      'Accept-Language': 'en',
      ...headers,
    },
  })
}

/** Fetch and parse JSON, or null on any failure. */
export async function upstreamJson<T>(
  url: string,
  options?: { timeoutMs?: number; headers?: Record<string, string> },
): Promise<T | null> {
  try {
    const response = await upstreamFetch(url, options)
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const inFlight = new Map<string, Promise<unknown>>()

/**
 * Run `load` at most once per TTL per key, and at most once concurrently.
 *
 * The in-flight map is doing real work, not micro-optimising: a cold instance
 * receiving several requests at once would otherwise fire the same twenty
 * upstream calls several times over, which is exactly the burst an authority
 * would rate-limit us for.
 *
 * A load that yields nothing is not cached. An empty result is far more likely to
 * be a transient upstream failure than a genuinely empty camera network, and
 * caching it would blank the layer for an hour.
 */
export async function cached<T>(key: string, load: () => Promise<T[]>): Promise<T[]> {
  const now = Date.now()

  const hit = cache.get(key)
  if (hit && now < hit.expiresAt) return hit.value as T[]

  const existing = inFlight.get(key)
  if (existing) return existing as Promise<T[]>

  const promise = load()
    .then((value) => {
      if (value.length > 0) cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
      // Serve the last good list when a refresh comes back empty, rather than
      // dropping every camera in a region because one poll failed.
      return value.length > 0 ? value : ((hit?.value as T[] | undefined) ?? value)
    })
    .catch(() => (hit?.value as T[] | undefined) ?? [])
    .finally(() => {
      inFlight.delete(key)
    })

  inFlight.set(key, promise)
  return promise
}

/** Coerce a possibly-string coordinate, rejecting anything unusable. */
export function coordinate(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Upstream payloads are frequently not the array their docs promise. */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}
