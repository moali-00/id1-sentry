import { useMemo } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'
import { linesToCollection } from '@/utils/geojson'
import { LINE_DASHED_LAYER_ID, LINE_LAYER_ID, LINE_SOURCE_ID } from '@/utils/mapLayers'
import type { MapLine } from '@/types/monitoring'

/**
 * Open paths — a trial's reach from launch site to impact zone, and an aircraft's
 * projected heading.
 *
 * Drawn *above* the area polygons and with a heavier stroke: an impact arc is a
 * claim about where something is going, and it should read as the strongest line
 * on the map rather than as another boundary. Split into solid and dashed layers
 * for the same reason as the outlines — `line-dasharray` is not data-driven.
 */

export function LineLayers({ lines, beforeId }: { lines: MapLine[]; beforeId?: string }) {
  const data = useMemo(() => linesToCollection(lines), [lines])

  return (
    <Source id={LINE_SOURCE_ID} type="geojson" data={data}>
      <Layer
        id={LINE_LAYER_ID}
        type="line"
        beforeId={beforeId}
        filter={['!', ['get', 'dashed']]}
        layout={{ 'line-cap': 'round' }}
        paint={{ 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': 0.95 }}
      />
      <Layer
        id={LINE_DASHED_LAYER_ID}
        type="line"
        beforeId={beforeId}
        filter={['get', 'dashed']}
        layout={{ 'line-cap': 'round' }}
        paint={{
          'line-color': ['get', 'color'],
          'line-width': 2.5,
          'line-opacity': 0.95,
          'line-dasharray': [6, 5],
        }}
      />
    </Source>
  )
}
