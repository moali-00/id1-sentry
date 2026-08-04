import { useMemo } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'
import { areasToCollection } from '@/utils/geojson'
import {
  AREA_EXTRUSION_LAYER_ID,
  AREA_FILL_LAYER_ID,
  AREA_OUTLINE_DASHED_LAYER_ID,
  AREA_OUTLINE_LAYER_ID,
  AREA_SOURCE_ID,
} from '@/utils/mapLayers'
import type { MapArea } from '@/types/monitoring'

/**
 * Closed areas — AOI boxes, declared danger areas, imagery footprints.
 *
 * One source and three layers for every area on the map, rather than a layer per
 * data layer: colour, stroke weight and opacity are all read from the feature's
 * own properties, so twenty data layers share one definition. That is the shape
 * MapLibre wants, and it is why `utils/geojson.ts` copies the style inputs onto
 * `properties`.
 *
 * Areas are deliberately near-transparent and the fill is **not** interactive —
 * only the outline is. A filled polygon that swallowed clicks would make the
 * points underneath unusable, and every AOI box encloses the markers that matter.
 *
 * `emphasis` scales stroke and fill. Routine range activity is in force for weeks
 * and would be on the map whether or not a test were coming, so it recedes; a
 * declared launch trial draws at full strength. Without this every warning looked
 * equally important, which is the opposite of the truth.
 */

/**
 * How much of the base fill opacity survives on a dark basemap.
 *
 * These fills nest — the downrange fan holds the range box holds the pad box, with
 * corridors and warning bounds across all three — so four or five of them stack on
 * the same pixel. Over a pale basemap that reads as a pale tint. Over a near-black
 * one the same warm alphas compound into an olive-brown wash that looks like
 * terrain, hides the coastline, and swamps the outlines that carry the actual
 * information.
 *
 * So the fill recedes and the stroke does the work. The strokes are unchanged —
 * they are already at full opacity and read *better* against dark.
 */
const DARK_FILL_SCALE = 0.45

export function AreaLayers({
  areas,
  extruded = false,
  isLight = true,
  beforeId,
}: {
  areas: MapArea[]
  /**
   * Draw the published vertical extent as a volume.
   *
   * Only worth mounting on a tilted camera: seen straight down an extrusion is
   * indistinguishable from its own footprint, and it is not free to render.
   */
  extruded?: boolean
  /** Whether the basemap underneath is pale. Drives fill opacity — see above. */
  isLight?: boolean
  beforeId?: string
}) {
  const data = useMemo(() => areasToCollection(areas), [areas])
  const fillScale = isLight ? 1 : DARK_FILL_SCALE

  return (
    <Source id={AREA_SOURCE_ID} type="geojson" data={data}>
      <Layer
        id={AREA_FILL_LAYER_ID}
        type="fill"
        beforeId={beforeId}
        paint={{
          'fill-color': ['get', 'color'],
          // Dashed shapes are approximations or footprints, so they wash in even
          // more faintly than a published boundary at the same emphasis.
          'fill-opacity': [
            '*',
            fillScale,
            ['+', ['case', ['get', 'dashed'], 0.02, 0.04], ['*', 0.08, ['get', 'emphasis']]],
          ],
        }}
      />
      <Layer
        id={AREA_OUTLINE_LAYER_ID}
        type="line"
        beforeId={beforeId}
        filter={['!', ['get', 'dashed']]}
        paint={{
          'line-color': ['get', 'color'],
          'line-width': ['+', 1, ['*', 0.9, ['get', 'emphasis']]],
          'line-opacity': ['+', 0.25, ['*', 0.65, ['get', 'emphasis']]],
        }}
      />
      {/*
        A second layer purely for the dash pattern: `line-dasharray` takes no
        data-driven expression, so a dashed and a solid outline cannot share one
        layer however alike the rest of their paint is.
      */}
      <Layer
        id={AREA_OUTLINE_DASHED_LAYER_ID}
        type="line"
        beforeId={beforeId}
        filter={['get', 'dashed']}
        paint={{
          'line-color': ['get', 'color'],
          'line-width': 1,
          'line-dasharray': [5, 4],
          'line-opacity': ['+', 0.25, ['*', 0.65, ['get', 'emphasis']]],
        }}
      />

      {/*
        The declared volume.

        Airspace is three-dimensional and a NOTAM says how far up it goes, so a
        danger area with a published ceiling is drawn to it. The footprint stays
        beneath, which is deliberate: the ground shape is what an operator compares
        against a settlement or a coastline, and the volume is the extra fact.

        `heightM > 0` is the whole gate. An area whose ceiling the authority left
        as UNL parses to nothing and falls out here — see `utils/altitude.ts`. It is
        drawn flat rather than extruded to a number nobody published.
      */}
      {extruded && (
        <Layer
          id={AREA_EXTRUSION_LAYER_ID}
          type="fill-extrusion"
          filter={['>', ['get', 'heightM'], 0]}
          paint={{
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-base': ['get', 'baseM'],
            'fill-extrusion-height': ['get', 'heightM'],
            // Low enough to see the terrain, the markers and the other volumes
            // through it. A solid block would hide the target it encloses.
            'fill-extrusion-opacity': 0.25,
          }}
        />
      )}
    </Source>
  )
}
