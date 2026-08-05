import { registryHandler } from '../../api/_lib/handlers.ts'

/**
 * `GET /api/cctv` on Netlify.
 *
 * Netlify's v2 function signature is `(Request) => Response` — the same Web
 * standard the handlers are written against — so this is a re-export and nothing
 * more. There is no adapter here because none is needed; Vercel is the host that
 * needs one, in `api/_lib/node-adapter.ts`.
 *
 * The `/api/*` paths are mapped to these functions by the redirect block in
 * `netlify.toml`, which has to sit above the SPA catch-all: Netlify applies
 * redirects in file order, and `/*` would otherwise swallow them into index.html.
 */
export default registryHandler
