import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson'
import { layerColor } from '@/utils/layers'
import type { MapArea, MapLine } from '@/types/monitoring'

/**
 * View models → GeoJSON for MapLibre's `geojson` sources.
 *
 * MapLibre draws data, not objects: a polygon is a feature in a source, and how
 * it looks comes from paint expressions reading that feature's properties. So
 * everything a style needs — colour, emphasis, whether it is dashed — is copied
 * onto `properties` here, and the layer definitions stay static.
 *
 * That is the whole reason this file exists. Resolving `layerColor()` per feature
 * at render time would mean one MapLibre layer per data layer (twenty of them,
 * each with its own source) instead of one shared pair of layers driven by data.
 */

/** Properties every drawn feature carries. Read by paint expressions and hover. */
export interface FeatureProps {
  id: string
  layerId: string
  label: string
  detail: string
  color: string
  /** 0–1. Absent on the model means fully asserted, so it defaults to 1. */
  emphasis: number
  /** MapLibre filters cannot test `undefined`, so this is always a boolean. */
  dashed: boolean
  /**
   * Published vertical extent in metres, or zero for "none to draw".
   *
   * Zero rather than undefined so a single MapLibre filter — `heightM > 0` —
   * decides what extrudes. An area whose ceiling the authority left unpublished
   * therefore falls out of the extrusion layer by the same test that excludes one
   * with no ceiling at all, which is the correct treatment of both.
   */
  baseM: number
  heightM: number
}

const props = (source: MapArea | MapLine): FeatureProps => ({
  id: source.id,
  layerId: source.layerId,
  label: source.label,
  // Empty string rather than undefined: a missing key and a present-but-empty key
  // behave differently in a MapLibre expression, and only one of them is testable.
  detail: source.detail ?? '',
  color: layerColor(source.layerId),
  emphasis: 'emphasis' in source ? (source.emphasis ?? 1) : 1,
  dashed: source.dashed ?? false,
  baseM: 'baseM' in source ? (source.baseM ?? 0) : 0,
  heightM: 'heightM' in source ? (source.heightM ?? 0) : 0,
})

/**
 * Areas as polygon features.
 *
 * The ring is closed here if the source did not close it. GeoJSON requires a
 * repeated first vertex and MapLibre renders an unclosed ring as an open shape
 * with a visible seam — the AOI boxes and the NOTAM rings arrive closed, the
 * warning bounds boxes do not.
 */
export function areasToCollection(areas: MapArea[]): FeatureCollection<Polygon, FeatureProps> {
  return {
    type: 'FeatureCollection',
    features: areas.map((area): Feature<Polygon, FeatureProps> => {
      const ring = [...area.ring]
      const first = ring[0]
      const last = ring[ring.length - 1]
      if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push(first)

      return {
        type: 'Feature',
        id: area.id,
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: props(area),
      }
    }),
  }
}

/** Lines as LineString features — open paths, never filled. */
export function linesToCollection(lines: MapLine[]): FeatureCollection<LineString, FeatureProps> {
  return {
    type: 'FeatureCollection',
    features: lines.map((line): Feature<LineString, FeatureProps> => ({
      type: 'Feature',
      id: line.id,
      geometry: { type: 'LineString', coordinates: line.path },
      properties: props(line),
    })),
  }
}
