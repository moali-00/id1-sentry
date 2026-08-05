import type { CameraRecord } from '../../../src/types/cctv.ts'

/**
 * The guard every source ends with.
 *
 * Upstream registries routinely carry rows with a null position, a blank name or
 * no feed at all — a camera that is planned, decommissioned or misconfigured.
 * They are dropped here rather than plotted at 0°,0° in the Gulf of Guinea, which
 * is what a missing coordinate becomes if it is allowed through.
 */
export function plottable(camera: Partial<CameraRecord>): camera is CameraRecord {
  return (
    typeof camera.lat === 'number' &&
    Number.isFinite(camera.lat) &&
    typeof camera.lng === 'number' &&
    Number.isFinite(camera.lng) &&
    // (0, 0) is overwhelmingly a null island rather than a camera on the equator.
    !(camera.lat === 0 && camera.lng === 0) &&
    Boolean(camera.id) &&
    Boolean(camera.name) &&
    Boolean(camera.source) &&
    Boolean(camera.feed_url || camera.stream_url || camera.external_url)
  )
}
