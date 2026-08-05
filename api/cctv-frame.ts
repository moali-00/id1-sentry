import { frameHandler } from './_lib/handlers.ts'
import { toNodeHandler } from './_lib/node-adapter.ts'

/**
 * `GET /api/cctv-frame?url=<camera snapshot URL>`
 *
 * One camera's current frame. The most security-sensitive endpoint in the
 * codebase — read the comment on `frameHandler` before changing it.
 */
export default toNodeHandler(frameHandler)
