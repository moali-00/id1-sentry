/**
 * Colour helpers for the places a hue has to be computed at runtime — marker
 * `divIcon` markup, inline SVG fills and per-category tinted chips. Static
 * colours belong in Tailwind tokens, not here.
 */

/**
 * Apply an alpha channel to a `#rrggbb` literal.
 *
 * Returns the input unchanged if it is not a 6-digit hex value, so a token or
 * `var(...)` reference passed by mistake degrades to an opaque colour instead of
 * `rgba(NaN,NaN,NaN,a)`.
 */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.trim().replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return hex

  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
