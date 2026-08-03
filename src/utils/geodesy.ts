/**
 * Spherical geometry for drawing where a trial is aimed.
 *
 * The corridors and impact arcs span hundreds to thousands of kilometres, where
 * treating lat/lon as a flat plane visibly bends the wrong way. These are the
 * standard great-circle formulae on a spherical Earth — accurate to well under a
 * kilometre at these distances, which is far finer than the warnings themselves.
 */

const R_KM = 6371.0088
const RAD = Math.PI / 180
const DEG = 180 / Math.PI

/** Leaflet order — `[lat, lng]`. */
export type LatLngTuple = [number, number]

/**
 * The point `distanceKm` away from `[lat, lng]` along a compass `bearingDeg`.
 *
 * This is what turns a corridor's `{bearing_deg, near_km, far_km}` into an
 * actual shape on the map.
 */
export function destinationPoint(lat: number, lng: number, bearingDeg: number, distanceKm: number): LatLngTuple {
  const angular = distanceKm / R_KM
  const bearing = bearingDeg * RAD
  const lat1 = lat * RAD
  const lng1 = lng * RAD

  const sinLat2 = Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
  const lat2 = Math.asin(Math.min(1, Math.max(-1, sinLat2)))

  const y = Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1)
  const x = Math.cos(angular) - Math.sin(lat1) * sinLat2
  const lng2 = lng1 + Math.atan2(y, x)

  // Normalise longitude into [-180, 180] so a corridor crossing the date line
  // does not draw a stripe across the whole map.
  return [lat2 * DEG, ((lng2 * DEG + 540) % 360) - 180]
}

/**
 * An annular sector — the wedge a launch corridor actually describes.
 *
 * Two arcs at `nearKm` and `farKm` joined into one ring, swept across
 * `spanDeg` centred on `bearingDeg`. Drawn as a closed polygon so the area
 * between the two radii is what gets filled, rather than a solid pie slice
 * reaching back to the launch point.
 */
export function corridorWedge(
  originLat: number,
  originLng: number,
  bearingDeg: number,
  spanDeg: number,
  nearKm: number,
  farKm: number,
  steps = 24,
): LatLngTuple[] {
  const half = spanDeg / 2
  const start = bearingDeg - half
  const end = bearingDeg + half
  const ring: LatLngTuple[] = []

  // Outer arc, left to right.
  for (let i = 0; i <= steps; i += 1) {
    const bearing = start + ((end - start) * i) / steps
    ring.push(destinationPoint(originLat, originLng, bearing, farKm))
  }

  // Inner arc, back the other way, closing the annulus.
  for (let i = steps; i >= 0; i -= 1) {
    const bearing = start + ((end - start) * i) / steps
    ring.push(destinationPoint(originLat, originLng, bearing, Math.max(nearKm, 0.1)))
  }

  return ring
}

/**
 * Points along the great circle between two coordinates.
 *
 * A straight line in Web Mercator is not the shortest path over 1,200 km, and
 * drawing one would misrepresent where a coupled trial actually reaches.
 */
export function greatCircle(fromLat: number, fromLng: number, toLat: number, toLng: number, steps = 48): LatLngTuple[] {
  const lat1 = fromLat * RAD
  const lng1 = fromLng * RAD
  const lat2 = toLat * RAD
  const lng2 = toLng * RAD

  const delta =
    2 *
    Math.asin(
      Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2),
    )

  // Coincident endpoints have no arc to interpolate.
  if (delta === 0) return [[fromLat, fromLng]]

  const points: LatLngTuple[] = []
  for (let i = 0; i <= steps; i += 1) {
    const f = i / steps
    const a = Math.sin((1 - f) * delta) / Math.sin(delta)
    const b = Math.sin(f * delta) / Math.sin(delta)

    const x = a * Math.cos(lat1) * Math.cos(lng1) + b * Math.cos(lat2) * Math.cos(lng2)
    const y = a * Math.cos(lat1) * Math.sin(lng1) + b * Math.cos(lat2) * Math.sin(lng2)
    const z = a * Math.sin(lat1) + b * Math.sin(lat2)

    points.push([Math.atan2(z, Math.hypot(x, y)) * DEG, Math.atan2(y, x) * DEG])
  }

  return points
}

/** Great-circle distance in kilometres. */
export function distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const lat1 = fromLat * RAD
  const lat2 = toLat * RAD
  const dLat = lat2 - lat1
  const dLng = (toLng - fromLng) * RAD

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}
