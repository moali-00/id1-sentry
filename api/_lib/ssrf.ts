import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * Guard for the one endpoint that turns a caller-supplied URL into a network
 * request: `/api/cctv-frame`.
 *
 * That handler is a fetch-anything primitive with our server's network position,
 * which is a server-side request forgery hole unless the target is checked. It
 * must not be usable to reach cloud metadata (`169.254.169.254`), anything on the
 * deployment's private network, or a non-HTTP scheme.
 *
 * Two layers, because either alone is bypassable:
 *
 *  1. **Canonicalise the literal.** Reject non-dotted-quad IPv4 notations
 *     outright — `2130706433`, `0177.0.0.1` and `0x7f.0.0.1` are all loopback,
 *     and guessing which the kernel will accept is a losing game.
 *  2. **Resolve hostnames and re-check every answer.** A public name pointed at a
 *     private address is the usual bypass. Redirects are followed by hand so each
 *     hop is checked too, since a public URL that 302s to `127.0.0.1` would
 *     otherwise sail through.
 *
 * What this does *not* close is the DNS-rebinding race: we validate at lookup
 * time and Node resolves again when it connects. Pinning the socket to the
 * checked address is the only complete fix and is not reachable through `fetch`.
 * A rebinder therefore has to win a TTL=0 race, which is a much narrower hole
 * than the one being closed here.
 */

/** IPv4 ranges that must never be a fetch target, as `[network, prefix bits]`. */
const IPV4_BLOCKS: [network: string, bits: number][] = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // RFC1918
  ['100.64.0.0', 10], // CGNAT, and Tailscale
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local — includes the cloud metadata endpoint
  ['172.16.0.0', 12], // RFC1918
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16], // RFC1918
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, including the broadcast address
]

/**
 * IPv6 prefixes to refuse, matched as lowercase string prefixes.
 *
 * `::ffff:` covers the IPv4-mapped forms, which is what makes `::ffff:127.0.0.1`
 * a loopback address wearing an IPv6 costume.
 */
const IPV6_BLOCK_PREFIXES = [
  '::ffff:', // IPv4-mapped
  '64:ff9b:', // NAT64, both the well-known and local prefixes
  '100::', // discard
  '2001:db8:', // documentation
  'fc', // unique-local fc00::/7
  'fd',
  'fe8', // link-local fe80::/10
  'fe9',
  'fea',
  'feb',
  'fec', // site-local fec0::/10 — deprecated, still routable on some stacks
  'fed',
  'fee',
  'fef',
  'ff', // multicast ff00::/8
]

/**
 * Hostnames refused before they ever reach DNS.
 *
 * Independent of what they resolve to: none of these names is a legitimate
 * camera host, and a split-horizon resolver can point them anywhere.
 */
const BLOCKED_NAMES = [
  /^localhost$/i,
  /\.localhost$/i,
  /^host\.docker\.internal$/i,
  /\.local$/i,
  /\.internal$/i,
  /^metadata\.google\.internal$/i,
]

function ipv4ToInt(ip: string): number {
  const [a, b, c, d] = ip.split('.').map(Number)
  // Multiplication rather than shifts: `<<` coerces to a signed int32, so
  // anything at or above 128.0.0.0 would come out negative.
  return a * 0x1000000 + b * 0x10000 + c * 0x100 + d
}

function ipv4Blocked(ip: string): boolean {
  const value = ipv4ToInt(ip)
  return IPV4_BLOCKS.some(([network, bits]) => {
    const size = 2 ** (32 - bits)
    return Math.floor(value / size) === Math.floor(ipv4ToInt(network) / size)
  })
}

function ipv6Blocked(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  if (lower === '::' || lower === '::1') return true
  return IPV6_BLOCK_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

/**
 * The canonical dotted-quad form of `value`, or null if it is not one.
 *
 * Deliberately narrow. Every other IPv4 notation is rejected rather than
 * normalised — a camera URL never legitimately uses one, so accepting them would
 * only widen what has to be reasoned about.
 */
export function parseCanonicalIPv4(value: string): string | null {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) return null
  const parts = value.split('.').map(Number)
  if (parts.some((part) => part > 255)) return null
  return parts.join('.')
}

export interface HostCheck {
  ok: boolean
  reason?: string
}

/** Whether `host` — an IP literal or a name — is safe to fetch from. */
export async function checkHost(host: string): Promise<HostCheck> {
  const trimmed = host.trim()
  if (!trimmed) return { ok: false, reason: 'empty host' }

  if (BLOCKED_NAMES.some((pattern) => pattern.test(trimmed))) {
    return { ok: false, reason: 'reserved hostname' }
  }

  const bare = trimmed.replace(/^\[|\]$/g, '')
  const family = isIP(bare)

  if (family === 4) {
    const canonical = parseCanonicalIPv4(bare)
    if (!canonical) return { ok: false, reason: 'non-canonical IPv4 literal' }
    return ipv4Blocked(canonical) ? { ok: false, reason: 'IPv4 in a reserved range' } : { ok: true }
  }

  if (family === 6) {
    return ipv6Blocked(bare) ? { ok: false, reason: 'IPv6 in a reserved range' } : { ok: true }
  }

  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(trimmed)) {
    return { ok: false, reason: 'invalid hostname' }
  }

  let answers: { address: string; family: number }[]
  try {
    answers = await lookup(trimmed, { all: true })
  } catch {
    return { ok: false, reason: 'DNS lookup failed' }
  }
  if (answers.length === 0) return { ok: false, reason: 'hostname has no A or AAAA record' }

  // *Every* answer must be public. One private address among several is enough
  // for the connection to land there.
  for (const answer of answers) {
    const blocked = answer.family === 4 ? ipv4Blocked(answer.address) : ipv6Blocked(answer.address)
    if (blocked) return { ok: false, reason: 'hostname resolves into a reserved range' }
  }

  return { ok: true }
}

/**
 * `fetch`, with the target checked and every redirect hop re-checked.
 *
 * Throws rather than returning an error response, so a caller cannot forget to
 * look at the result.
 */
export async function safeFetch(
  input: string,
  { maxRedirects = 3, ...init }: RequestInit & { maxRedirects?: number } = {},
): Promise<Response> {
  let current = input

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    let url: URL
    try {
      url = new URL(current)
    } catch {
      throw new Error('safeFetch: invalid URL')
    }

    // `file:`, `gopher:` and friends. Note that `http:` is allowed — a good
    // number of camera hosts are plain HTTP, which is precisely why the browser
    // cannot fetch them itself and this proxy exists.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`safeFetch: blocked protocol ${url.protocol}`)
    }

    const check = await checkHost(url.hostname)
    if (!check.ok) throw new Error(`safeFetch: blocked target — ${check.reason}`)

    const response = await fetch(current, { ...init, redirect: 'manual' })
    if (response.status < 300 || response.status >= 400) return response

    const location = response.headers.get('location')
    if (!location) return response
    current = new URL(location, current).toString()
  }

  throw new Error('safeFetch: too many redirects')
}

/* ── Rate limiting ───────────────────────────────────────────────────────── */

const buckets = new Map<string, { count: number; resetAt: number }>()

/**
 * Fixed-window limiter, per serverless instance.
 *
 * Per-instance is the honest description: Vercel runs several, so the real
 * ceiling is this multiplied by however many are warm. It is an abuse brake on
 * an open image proxy, not a quota — the thing it has to stop is one client
 * pointing the proxy at a large file in a loop.
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()

  // Swept on read. There is no timer in a serverless instance to sweep on, and
  // the map would otherwise grow for the life of the instance.
  for (const [existing, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(existing)
  }

  const bucket = buckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }

  bucket.count += 1
  return bucket.count > limit
}

/** Best-effort client identity for the limiter. Spoofable; only used for bucketing. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}
