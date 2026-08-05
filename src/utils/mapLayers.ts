/**
 * Ids of the MapLibre sources and layers the app adds on top of the basemap.
 *
 * Named here rather than inline in the components because they are referenced
 * from three directions: the `<Layer>` that defines them, the map's
 * `interactiveLayerIds`, and `queryRenderedFeatures` when resolving a hover. A
 * typo in any one of those fails silently — the layer simply never matches.
 */

export const AREA_SOURCE_ID = 'areas'
export const AREA_FILL_LAYER_ID = 'areas-fill'
export const AREA_OUTLINE_LAYER_ID = 'areas-outline'
export const AREA_OUTLINE_DASHED_LAYER_ID = 'areas-outline-dashed'
export const AREA_EXTRUSION_LAYER_ID = 'areas-extrusion'

export const LINE_SOURCE_ID = 'lines'
export const LINE_LAYER_ID = 'lines-solid'
export const LINE_DASHED_LAYER_ID = 'lines-dashed'

/**
 * Live aircraft. One source, three layers — a selection ring, a dot for contacts
 * with no reported track, and the rotated silhouette for everything else.
 *
 * These are added imperatively by `useAircraftLayer` rather than as `<Layer>`
 * children, because their geometry is rewritten every frame.
 */
export const AIRCRAFT_SOURCE_ID = 'aircraft'
export const AIRCRAFT_HALO_LAYER_ID = 'aircraft-halo'
export const AIRCRAFT_DOT_LAYER_ID = 'aircraft-dot'
export const AIRCRAFT_SYMBOL_LAYER_ID = 'aircraft-symbol'

/** The flown path behind the one aircraft with an open dossier. */
export const AIRCRAFT_TRAIL_SOURCE_ID = 'aircraft-trail'
export const AIRCRAFT_TRAIL_LAYER_ID = 'aircraft-trail-line'

/** The aircraft marks a cursor can land on — the ring is decoration, not a target. */
export const AIRCRAFT_LAYER_IDS = [AIRCRAFT_SYMBOL_LAYER_ID, AIRCRAFT_DOT_LAYER_ID]

/**
 * The layers a hover can land on.
 *
 * Only outlines and lines, never an area's fill. A filled polygon that answered
 * to the cursor would swallow every point inside it, and every AOI box encloses
 * the markers that matter.
 *
 * Aircraft are first, and order matters here: `queryRenderedFeatures` returns
 * matches in the order the layers are listed, and the caller takes the first. A
 * contact inside a danger area would otherwise resolve to the area's outline
 * rather than to the aircraft the cursor is actually on.
 */
export const HOVERABLE_LAYER_IDS = [
  ...AIRCRAFT_LAYER_IDS,
  AREA_OUTLINE_LAYER_ID,
  AREA_OUTLINE_DASHED_LAYER_ID,
  LINE_LAYER_ID,
  LINE_DASHED_LAYER_ID,
]
