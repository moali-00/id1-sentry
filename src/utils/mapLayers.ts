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
 * The layers a hover can land on.
 *
 * Only outlines and lines, never an area's fill. A filled polygon that answered
 * to the cursor would swallow every point inside it, and every AOI box encloses
 * the markers that matter.
 */
export const HOVERABLE_LAYER_IDS = [
  AREA_OUTLINE_LAYER_ID,
  AREA_OUTLINE_DASHED_LAYER_ID,
  LINE_LAYER_ID,
  LINE_DASHED_LAYER_ID,
]
