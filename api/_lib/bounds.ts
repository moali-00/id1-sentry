/**
 * The viewport, and which regions it touches.
 *
 * Region selection is by **rectangle intersection**, not by testing the map's
 * centre point. Centre-testing is what the reference implementation did, and it
 * fails in the ordinary case: a viewport framing the Channel is centred on water,
 * so neither the UK nor France matches and the layer comes back empty over one of
 * the densest camera networks in the port. A rectangle that overlaps London
 * fetches London whether or not the crosshair is on it.
 */

export interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

/** Parse `bbox=west,south,east,north`, rejecting anything malformed. */
export function parseBounds(value: string | null): Bounds | null {
  if (!value) return null

  const parts = value.split(',').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null

  const [west, south, east, north] = parts
  if (south > north) return null
  if (south < -90 || north > 90) return null

  return { west, south, east, north }
}

/**
 * Whether two rectangles overlap.
 *
 * Longitude is compared through the *span* rather than by west < east, because a
 * viewport crossing the antimeridian arrives with west greater than east — and a
 * naive comparison would then match nothing, blanking the layer over the Pacific.
 * Normalising both to a start-plus-width form handles the wrap without a special
 * case for it.
 */
export function intersects(a: Bounds, b: Bounds): boolean {
  if (a.north < b.south || b.north < a.south) return false

  const spanA = a.east >= a.west ? a.east - a.west : a.east - a.west + 360
  const spanB = b.east >= b.west ? b.east - b.west : b.east - b.west + 360

  // A viewport wider than the globe overlaps every region by definition.
  if (spanA >= 360 || spanB >= 360) return true

  // Compare in a frame anchored on `a`'s western edge, so both spans run forwards.
  const offsetB = ((b.west - a.west) % 360 + 360) % 360
  return offsetB < spanA || offsetB + spanB > 360
}
