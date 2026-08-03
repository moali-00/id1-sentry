import { useEffect } from 'react'
import L, { type Map as LeafletMap } from 'leaflet'

/**
 * Draw the solar terminator — the shaded half of the world is in darkness now.
 *
 * The maths is a low-precision solar-position model (good to a fraction of a
 * degree, which is far below what a world-scale polygon can show) so the layer
 * needs no dependency and no network call.
 */

const RAD = Math.PI / 180
const DEG = 180 / Math.PI

/** How often the terminator is redrawn. The Earth turns 0.25° in a minute. */
const REDRAW_MS = 60_000

/** Vertices along the terminator. 2° of longitude is smooth at world zoom. */
const STEP_DEGREES = 2

interface SunPosition {
  /** Solar declination, radians. Positive is northern summer. */
  declination: number
  /** Longitude directly under the sun, degrees. */
  subsolarLng: number
}

function sunPosition(at: Date): SunPosition {
  // Days since the J2000.0 epoch.
  const julianDay = at.getTime() / 86_400_000 + 2440587.5
  const n = julianDay - 2451545

  const meanLongitude = (280.46 + 0.9856474 * n) % 360
  const meanAnomaly = ((357.528 + 0.9856003 * n) % 360) * RAD
  const eclipticLongitude = (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD
  const obliquity = (23.439 - 0.0000004 * n) * RAD

  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude))
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude))

  const gmstHours = (18.697374558 + 24.06570982441908 * n) % 24
  const subsolarLng = ((((rightAscension * DEG - gmstHours * 15) % 360) + 540) % 360) - 180

  return { declination, subsolarLng }
}

/**
 * Ring enclosing the unlit hemisphere.
 *
 * The terminator itself is only a curve, so the ring is closed over whichever
 * pole is in polar night — the south in northern summer, and vice versa.
 */
function nightRing(at: Date): L.LatLngExpression[] {
  const { declination, subsolarLng } = sunPosition(at)

  // Near an equinox `tan(declination)` approaches zero and the latitude blows
  // up; clamping keeps the polygon finite and visually identical.
  const tanDec = Math.tan(declination)
  const safeTanDec = Math.abs(tanDec) < 1e-6 ? Math.sign(tanDec || 1) * 1e-6 : tanDec

  const darkPole = declination > 0 ? -90 : 90
  const ring: L.LatLngExpression[] = []

  for (let lng = -180; lng <= 180; lng += STEP_DEGREES) {
    const hourAngle = (lng - subsolarLng) * RAD
    const lat = Math.atan(-Math.cos(hourAngle) / safeTanDec) * DEG
    ring.push([lat, lng])
  }

  ring.push([darkPole, 180], [darkPole, -180])
  return ring
}

export function useDayNightLayer(map: LeafletMap | null, visible: boolean): void {
  useEffect(() => {
    if (!map || !visible) return

    const polygon = L.polygon(nightRing(new Date()), {
      // Night is a wash over the basemap, not a feature to click.
      interactive: false,
      stroke: true,
      color: '#64748b',
      weight: 1,
      opacity: 0.35,
      fillColor: '#0b1220',
      fillOpacity: 0.22,
    }).addTo(map)

    // Behind every marker but above the tiles.
    polygon.bringToBack()

    const timer = window.setInterval(() => polygon.setLatLngs(nightRing(new Date())), REDRAW_MS)

    return () => {
      window.clearInterval(timer)
      polygon.remove()
    }
  }, [map, visible])
}
