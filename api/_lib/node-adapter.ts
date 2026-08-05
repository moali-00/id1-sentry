import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Bridge from a Node request/response pair to a Web-standard handler.
 *
 * The only file in `api/` that knows what host it is running on. Vercel's `/api`
 * convention hands a function `(req, res)` in Node's own shapes, and the Vite dev
 * server's middleware stack does the same — so one adapter serves both, and the
 * handlers stay portable.
 *
 * Typed against `node:http` rather than `@vercel/node` on purpose: `@types/node`
 * is already a dependency, and taking the host's SDK for two type imports would
 * make the code Vercel-specific for no benefit.
 */

type WebHandler = (request: Request) => Promise<Response>

/** Absolute URL for the incoming request, which `Request` requires and Node omits. */
function absoluteUrl(req: IncomingMessage): string {
  // Behind a proxy the original scheme is only in the header; `x-forwarded-proto`
  // is what distinguishes a request that arrived over TLS from one that did not.
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ?? 'http'
  const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.headers.host ?? 'localhost'
  return `${proto}://${host}${req.url ?? '/'}`
}

export function toNodeHandler(handler: WebHandler) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // Every camera endpoint is a read. Answering anything else would only widen
    // the surface of a proxy that already has to be careful.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.setHeader('Allow', 'GET, HEAD')
      res.end(JSON.stringify({ error: 'Method not allowed' }))
      return
    }

    let response: Response
    try {
      response = await handler(new Request(absoluteUrl(req), { method: 'GET' }))
    } catch {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Handler failed' }))
      return
    }

    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))

    // A HEAD must carry the headers and none of the body.
    if (req.method === 'HEAD') {
      res.end()
      return
    }

    // `arrayBuffer` rather than piping the stream: every response here is either a
    // small JSON object or a single capped frame, both already fully in memory.
    const body = Buffer.from(await response.arrayBuffer())
    res.end(body)
  }
}
