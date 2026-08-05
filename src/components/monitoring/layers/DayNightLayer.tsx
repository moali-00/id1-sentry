import { useEffect, useMemo, useState } from 'react'
import type { FeatureCollection, Polygon } from 'geojson'
import { Layer, Source } from 'react-map-gl/maplibre'
import { nightRing } from '@/utils/solar'

/**
 * The solar terminator — the shaded half of the world is in darkness now.
 *
 * Night is a wash over the basemap rather than a feature to click, so this layer
 * is left out of `interactiveLayerIds` and carries no tooltip. The maths lives in
 * `utils/solar.ts`.
 */

/** How often the terminator is redrawn. The Earth turns 0.25° in a minute. */
const REDRAW_MS = 60_000

export function DayNightLayer({ beforeId }: { beforeId?: string }) {
  const [at, setAt] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setAt(new Date()), REDRAW_MS)
    return () => window.clearInterval(timer)
  }, [])

  const data = useMemo<FeatureCollection<Polygon>>(
    () => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [nightRing(at)] },
          properties: {},
        },
      ],
    }),
    [at],
  )

  return (
    <Source id="day-night" type="geojson" data={data}>
      <Layer
        id="day-night-fill"
        type="fill"
        beforeId={beforeId}
        paint={{ 'fill-color': '#0d1117', 'fill-opacity': 0.22 }}
      />
      <Layer
        id="day-night-edge"
        type="line"
        beforeId={beforeId}
        paint={{ 'line-color': '#6a7282', 'line-width': 1, 'line-opacity': 0.35 }}
      />
    </Source>
  )
}
