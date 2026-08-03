import { env, hasApi } from '@/utils/env'

/**
 * Thin typed wrapper over `fetch` for the monitoring API.
 *
 * Everything the dashboard reads goes through here so there is exactly one place
 * that knows the base URL, the error shape and the timeout. The endpoint modules
 * in this folder layer fixture fallbacks on top; this file never touches
 * fixtures itself.
 */

/** A request that reached the server but was refused, or never reached it. */
export class ApiError extends Error {
  /** HTTP status, or 0 when the request never completed. */
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Requests are abandoned rather than left hanging behind a stalled backend. */
const TIMEOUT_MS = 15_000

export interface RequestOptions {
  /** Appended as a query string; `undefined` and empty values are dropped. */
  params?: Record<string, string | number | undefined>
  /** Caller-owned cancellation, combined with the internal timeout. */
  signal?: AbortSignal
}

function buildUrl(path: string, params: RequestOptions['params']): string {
  const url = new URL(`${env.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === '') continue
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

/**
 * GET `path` and parse the JSON body as `T`.
 *
 * Throws `ApiError` for every failure mode — non-2xx, network error, timeout and
 * unparseable body alike — so callers only ever handle one error type.
 */
export async function request<T>(path: string, { params, signal }: RequestOptions = {}): Promise<T> {
  if (!hasApi()) throw new ApiError('No API base URL configured', 0)

  // `AbortSignal.any` keeps the caller's cancellation working alongside the
  // timeout instead of one replacing the other.
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(buildUrl(path, params), {
      signal: combined,
      headers: { Accept: 'application/json' },
      credentials: 'omit',
    })
  } catch (cause) {
    // An abort the caller asked for is not an API failure — let it propagate so
    // React effects can unmount quietly.
    if (signal?.aborted) throw cause
    throw new ApiError(cause instanceof Error ? cause.message : 'Network request failed', 0)
  }

  if (!response.ok) throw new ApiError(`${response.status} ${response.statusText}`.trim(), response.status)

  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError('Response was not valid JSON', response.status)
  }
}
