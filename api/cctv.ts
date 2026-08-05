import { registryHandler } from './_lib/handlers.ts'
import { toNodeHandler } from './_lib/node-adapter.ts'

/**
 * `GET /api/cctv?bbox=west,south,east,north`
 *
 * The camera registry for one viewport. See `_lib/handlers.ts` for what it does
 * and `_lib/registry.ts` for where the cameras come from.
 *
 * Files directly under `api/` are routes; `api/_lib/` is not, because a leading
 * underscore excludes a path from filesystem routing. The route names are flat
 * (`cctv-frame`, not `cctv/frame`) so there is no question about a file and a
 * directory of the same name coexisting.
 */
export default toNodeHandler(registryHandler)
