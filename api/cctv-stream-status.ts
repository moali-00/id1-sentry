import { streamStatusHandler } from './_lib/handlers.ts'
import { toNodeHandler } from './_lib/node-adapter.ts'

/**
 * `GET /api/cctv-stream-status?url=<embed URL>`
 *
 * Whether an embedded player will actually show anything. Answers for rtsp.me
 * only; everything else reports "not knowable", which is not the same as broken.
 */
export default toNodeHandler(streamStatusHandler)
