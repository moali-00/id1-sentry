/**
 * Vertical limits, as published in a NOTAM, converted to metres.
 *
 * Airspace is a volume, and a NOTAM says so: an item-F/G pair like `SFC` / `FL200`
 * states that the danger area runs from the surface to 20,000 ft. Drawing that as
 * a flat outline throws the vertical half of the declaration away.
 *
 * The rule this file exists to enforce: **a limit that is not a published number
 * returns null.** `UNL` means the authority declared no ceiling, not that the
 * ceiling is large; an unrecognised string means we could not read it. Both are
 * the difference between "we looked and found nothing" and "we could not look" —
 * the same distinction `SourceHealth` draws between `empty` and `error` — and
 * neither is a licence to invent a number to extrude to.
 */

const FEET_TO_M = 0.3048

/** A flight level is hundreds of feet: FL200 is 20,000 ft. */
const FLIGHT_LEVEL_TO_FEET = 100

export interface Altitude {
  metres: number
  /**
   * What the figure is measured from.
   *
   * `agl` is above ground level, `amsl` above mean sea level. MapLibre extrudes
   * from the terrain surface, so an `agl` figure is exact and an `amsl` one is
   * over-tall by the ground elevation beneath it. Across this AOI that error is
   * single-digit metres — the pad complex, the Chandipur range and every
   * settlement in the evacuation reporting are all within a few metres of sea
   * level — so the two are drawn alike. On a mountainous target they would not be.
   */
  datum: 'amsl' | 'agl'
}

/** Ground, by any of the spellings that appear in a NOTAM. */
const GROUND = new Set(['SFC', 'GND', 'SURFACE', 'GROUND'])

/** No published ceiling. Not a height. */
const UNLIMITED = new Set(['UNL', 'UNLIM', 'UNLIMITED'])

/**
 * Parse one limit string.
 *
 * Returns null for ground-relative-unbounded (`UNL`), for an empty field, and for
 * anything the grammar below does not cover — never a fallback value.
 */
export function parseAltitude(limit: string | null | undefined): Altitude | null {
  if (!limit) return null

  const text = limit.trim().toUpperCase()
  if (text.length === 0) return null
  if (UNLIMITED.has(text)) return null
  if (GROUND.has(text)) return { metres: 0, datum: 'agl' }

  const datum: Altitude['datum'] = text.includes('AGL') ? 'agl' : 'amsl'

  // FL200, FL 200 — flight level, hundreds of feet.
  const flightLevel = /^FL\s*(\d{1,3})$/.exec(text)
  if (flightLevel) {
    return { metres: Number(flightLevel[1]) * FLIGHT_LEVEL_TO_FEET * FEET_TO_M, datum: 'amsl' }
  }

  // 6000FT AMSL, 6000 FT, 2000M AGL, 2000 M AMSL.
  const measured = /^(\d{1,6})(?:\.\d+)?\s*(FT|F|M)\b/.exec(text)
  if (measured) {
    const value = Number(measured[1])
    return { metres: measured[2] === 'M' ? value : value * FEET_TO_M, datum }
  }

  return null
}

/**
 * The vertical extent of a danger area, or null if it has none to draw.
 *
 * Null when the ceiling is unpublished or unreadable, and also when the pair does
 * not describe a positive volume — a zero-height box is not a volume, and a
 * ceiling below its own floor is bad data rather than an inverted volume.
 */
export function verticalExtent(
  lower: string | null | undefined,
  upper: string | null | undefined,
): { baseM: number; heightM: number } | null {
  const ceiling = parseAltitude(upper)
  if (!ceiling) return null

  // An absent floor is the surface. That is not an assumption: a NOTAM that omits
  // item F is ground-up by convention, and it is also the conservative reading.
  const floor = parseAltitude(lower) ?? { metres: 0, datum: 'agl' as const }

  if (!(ceiling.metres > floor.metres)) return null
  return { baseM: floor.metres, heightM: ceiling.metres }
}
