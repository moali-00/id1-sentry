import { useMemo } from 'react'
import type { FeatureCollection, LineString } from 'geojson'
import { Layer, Source } from 'react-map-gl/maplibre'

/**
 * Latitude/longitude grid.
 *
 * A reference frame for judging distance and bearing by eye when the basemap is
 * mostly ocean — which, on a monitoring map, it often is.
 *
 * The geometry never changes, so it is built once at module scope rather than
 * memoised per mount.
 */

/** Grid spacing in degrees. Coarse enough to stay readable at world zoom. */
const INTERVAL = 30

/** The equator and prime meridian are drawn heavier than the rest. */
const AXIS_WEIGHT = 1.1
const LINE_WEIGHT = 0.6

/**
 * Meridians stop at ±85°.
 *
 * In Mercator the poles are at infinity, so a line drawn to ±90° has nowhere to
 * end. Under globe projection the same clamp leaves a small gap at each pole,
 * which is honest — the grid is a reading aid, not a claim about the geometry.
 */
const MERIDIAN_LIMIT = 85

const GRATICULE: FeatureCollection<LineString, { axis: boolean }> = {
  type: 'FeatureCollection',
  features: [
    ...Array.from({ length: Math.floor(180 / INTERVAL) - 1 }, (_, i) => -90 + INTERVAL * (i + 1)).map((lat) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [-180, lat],
          [0, lat],
          [180, lat],
        ],
      },
      properties: { axis: lat === 0 },
    })),
    ...Array.from({ length: Math.floor(360 / INTERVAL) + 1 }, (_, i) => -180 + INTERVAL * i).map((lng) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [lng, -MERIDIAN_LIMIT],
          [lng, 0],
          [lng, MERIDIAN_LIMIT],
        ],
      },
      properties: { axis: lng === 0 },
    })),
  ],
}

export function GraticuleLayer({ beforeId }: { beforeId?: string }) {
  // Stable identity so the source is not re-fed on every parent render.
  const data = useMemo(() => GRATICULE, [])

  return (
    <Source id="graticule" type="geojson" data={data}>
      <Layer
        id="graticule-lines"
        type="line"
        beforeId={beforeId}
        paint={{
          'line-color': '#99a1af',
          'line-width': ['case', ['get', 'axis'], AXIS_WEIGHT, LINE_WEIGHT],
          'line-opacity': ['case', ['get', 'axis'], 0.5, 0.3],
        }}
      />
    </Source>
  )
}
