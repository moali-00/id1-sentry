/** Formatting helpers shared across the dashboard. */

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY

/**
 * Compact relative age of a unix-seconds timestamp, e.g. `3m`, `2h`, `5d`.
 *
 * `now` is injected so callers can pass a single timestamp when formatting a
 * batch (keeping a list internally consistent) and so it stays testable.
 */
export function relativeTime(unixSeconds: number, now: number = Date.now()): string {
  const elapsed = Math.max(0, Math.floor(now / 1000 - unixSeconds))

  if (elapsed < MINUTE) return `${elapsed}s`
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`
  if (elapsed < MONTH) return `${Math.floor(elapsed / DAY)}d`
  return `${Math.floor(elapsed / MONTH)}mo`
}

/** Bucket a 0–5 confidence score into the wording analysts use. */
export function confidenceLabel(score: number): 'low' | 'medium' | 'high' {
  if (score <= 2) return 'low'
  if (score === 3) return 'medium'
  return 'high'
}

/** Trim to `limit` characters on a clean boundary, appending an ellipsis. */
export function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text
}

/** Title-case each word — used to name a watch after its own keyword. */
export function titleCase(text: string): string {
  return text.replace(/\b\w/g, (char) => char.toUpperCase())
}

/**
 * Strip service plumbing out of prose that came from the payload.
 *
 * The assessment writes operator-facing sentences, but some of them end in an
 * instruction to the service that produced them — "…— poll POST /v1/aircraft/
 * observe on a schedule". That is a note to whoever runs the collection, not to
 * whoever is reading the dossier, and it is the only kind of text in the feed
 * that names an endpoint. Cut the clause rather than the sentence: the part
 * before the dash is the actual finding.
 */
export function plainText(text: string): string
export function plainText(text: string | null | undefined): string | undefined
export function plainText(text: string | null | undefined): string | undefined {
  if (!text) return text ?? undefined

  return (
    text
      // The trailing "— poll GET /v1/… on a schedule" style advisory.
      .replace(/\s*[—–-]\s*(?:poll|call|query|hit|fetch)\b[^.;]*/gi, '')
      // Any bare method-and-path or path that survived elsewhere in the sentence.
      .replace(/\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/\S+/g, '')
      .replace(/\s*\/v\d+\/\S+/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.;,])/g, '$1')
      .trim()
  )
}
