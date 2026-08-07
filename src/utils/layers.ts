import type { DataLayer, DataLayerId, LayerGroupKey, SignalLayerId } from '@/types/monitoring'

/**
 * The map layer registry.
 *
 * Watches are dynamic — they come from state — so the `watches` group has no
 * entries here; the rail renders its rows from `selectWatches` instead. Every
 * other layer is static and declared once below, in the style of `CATEGORIES` in
 * `./constants.ts`.
 *
 * Hues are theme-independent for the same reason the threat categories are: a
 * layer must read the same in light and dark so the legend stays learnable.
 */

/**
 * Watches and the generic signal layers.
 *
 * On. The ITR target is the primary subject but not the only one: the watch rows
 * sit above it in the rail, each independently toggleable, and the create/edit
 * form is reachable from the group's footer.
 *
 * Kept as a flag rather than being inlined, because it is the one switch that
 * turns the dashboard from a single-target instrument into a multi-watch one, and
 * every consumer reads it to decide whether watch clusters reach the map, the
 * feed and search (`MapCanvas`, `ActivityFeed`, `SearchBar`, `Legend`,
 * `LayerRail`). Setting it back to `false` restores single-target mode with no
 * other change.
 */
export const WATCHES_ENABLED = true

const ALL_GROUPS: { key: LayerGroupKey; label: string }[] = [
  // The rail's own header already reads LAYERS — a group called
  // "WATCHES · LAYERS" underneath it just said the same word twice.
  { key: 'watches', label: 'WATCHES' },
  { key: 'signals', label: 'SIGNALS' },
  { key: 'itr_zones', label: 'ZONES' },
  { key: 'itr_feeds', label: 'FEEDS' },
  { key: 'cameras', label: 'CAMERAS' },
  { key: 'display', label: 'DISPLAY' },
]

/**
 * The groups the layer rail renders.
 *
 * `watches` always renders — it holds the ITR target row, which is not an
 * operator watch. The generic demo signal layers go with `WATCHES_ENABLED`.
 *
 * **`display` is not in the rail.** Its three overlays are real layers and stay in
 * `DATA_LAYERS` — the registry, the URL's `layers=` list and `layerEnabled` all
 * still know about them — but they are rendered by `DisplayPanel` in the command
 * bar, alongside the projection and basemap controls they belong with. The rail is
 * for *what is drawn on the map*; how it is drawn is a different question, and
 * keeping both in one list pushed the flat/globe switch below the fold.
 */
export const LAYER_GROUPS = ALL_GROUPS.filter(
  (group) => group.key !== 'display' && (WATCHES_ENABLED || group.key !== 'signals'),
)

export const DATA_LAYERS: DataLayer[] = [
  {
    id: 'global_incidents',
    label: 'Global incidents',
    groupKey: 'signals',
    color: '#fb923c',
    hint: 'Reported incidents from open news and event feeds',
    defaultOn: false,
  },
  {
    id: 'earthquakes',
    label: 'Earthquakes · 24h',
    groupKey: 'signals',
    color: '#facc15',
    hint: 'Seismic events above M4.0 in the last 24 hours',
    defaultOn: false,
  },
  {
    id: 'live_news',
    label: 'Live news',
    groupKey: 'signals',
    color: '#38bdf8',
    hint: 'Geolocated breaking-news datelines',
    defaultOn: false,
  },
  {
    id: 'maritime',
    label: 'Maritime',
    groupKey: 'signals',
    color: '#22d3ee',
    hint: 'Ports, chokepoints and flagged vessel activity',
    defaultOn: false,
  },
  /* ── Abdul Kalam Island (ITR) ────────────────────────────────────────────
   *
   * The four AOI boxes from `/v1/aoi`. They nest — pad inside range inside
   * airspace, with downrange reaching into the Bay of Bengal — so each gets its
   * own toggle rather than being one "show boundaries" switch.
   */
  {
    id: 'aoi_pad',
    label: 'Pad complex',
    groupKey: 'itr_zones',
    color: '#f43f5e',
    hint: 'Launch complexes — a thermal detection inside this box is significant',
    explain:
      'The launch complexes themselves. A thermal detection inside this box would be significant; one outside it almost certainly is not.',
    defaultOn: true,
  },
  {
    id: 'aoi_range',
    label: 'Range',
    groupKey: 'itr_zones',
    color: '#fb923c',
    hint: 'Both ITR complexes and the adjacent coast',
    explain: 'Both ITR complexes and the coast between them — the area a trial is prepared in, rather than aimed at.',
    defaultOn: true,
  },
  {
    id: 'aoi_airspace',
    label: 'Airspace watch',
    groupKey: 'itr_zones',
    color: '#a78bfa',
    hint: 'The box whose air traffic is counted for signs of clearing',
    explain:
      'The box whose air traffic is counted. A drop below the hourly baseline suggests airspace is being cleared for a trial.',
    defaultOn: false,
  },
  {
    id: 'aoi_downrange',
    label: 'Downrange fan',
    groupKey: 'itr_zones',
    color: '#22d3ee',
    hint: 'Bay of Bengal impact fan where danger areas are declared',
    explain:
      'The Bay of Bengal fan where impact and danger areas get declared. Nothing here is a prediction — it is the area the authorities reserve.',
    defaultOn: false,
  },

  {
    id: 'itr_sites',
    label: 'Sites',
    groupKey: 'itr_feeds',
    color: '#f43f5e',
    hint: 'The island itself and the secondary ITR complex at Chandipur',
    explain:
      'The monitored target and its secondary complex. Everything else on this map is context around these two points.',
    defaultOn: true,
  },
  {
    id: 'itr_warnings',
    label: 'Maritime warnings',
    groupKey: 'itr_feeds',
    color: '#facc15',
    hint: 'NAVAREA VIII danger areas — centroid plus the declared boundary',
    explain:
      'A navigational danger area India declared to NAVAREA VIII. It states where mariners must keep clear, which is the closest thing to an official notice that a trial is planned.',
    defaultOn: true,
  },
  {
    id: 'itr_corridors',
    label: 'Launch corridors',
    groupKey: 'itr_feeds',
    color: '#f43f5e',
    hint: 'Declared danger areas for launch trials — the signal, separated from routine range activity',
    explain:
      'A danger area India declared for an experimental flight trial — the coordinates published in the warning itself, not an inferred shape. These are the launch indicators; routine firing exercises are on their own layer.',
    defaultOn: true,
  },
  {
    id: 'itr_routine',
    label: 'Routine exercises',
    groupKey: 'itr_feeds',
    color: '#94a3b8',
    hint: 'Firing exercises and navigation hazards — standing range activity, not launch trials',
    explain:
      'A gunnery, air-defence or navigation warning. These are in force for weeks at a time and would be here whether or not a test were coming, so they are drawn back as background rather than as signal.',
    defaultOn: true,
  },
  {
    id: 'itr_impact',
    label: 'Impact reach',
    groupKey: 'itr_feeds',
    color: '#fb7185',
    hint: 'Coupled trials — launch site to the separate downrange impact zone',
    explain:
      'Two warnings that pair up — a launch corridor near the island and a separate impact zone far downrange. Together they imply one long-range trial rather than two unrelated exercises.',
    defaultOn: true,
  },
  {
    id: 'itr_danger_areas',
    label: 'Danger areas',
    groupKey: 'itr_feeds',
    color: '#a78bfa',
    hint: 'Airspace danger areas declared by NOTAM over the Kolkata FIR',
    explain:
      'Airspace closed by NOTAM. Where the shape is approximated from a centre and a radius it is drawn dashed, because the boundary is an approximation rather than the authority’s published outline.',
    defaultOn: true,
  },
  {
    id: 'itr_closure',
    label: 'Closure · verified',
    groupKey: 'itr_feeds',
    // Lime, used by no other layer. It has to be told apart from the violet
    // danger area it is drawn on top of — that pairing is the point of the layer.
    color: '#a3e635',
    hint: 'The airspace closure redrawn from its published radius — after-action correction',
    explain:
      'VED-52 as the NOTAM actually publishes it: a 35 NM circle around 21-23N 087-22E. The danger-area layer draws the same closure from the four-point bounding box the capture stored, and that box is wide enough to enclose Abdul Kalam Island. The circle does not — the island sits 10.6 km outside it, while Chandipur, the site the Ministry of Defence named, sits 11.0 km inside. Switch both on to see the difference.',
    // On by default. It is one polygon, and it corrects a shape already drawn.
    defaultOn: true,
  },
  {
    id: 'itr_evacuations',
    label: 'Civil precursors',
    groupKey: 'itr_feeds',
    color: '#c27aff',
    hint: 'Settlements named in evacuation reporting, resolved to coordinates',
    explain:
      'A town named in evacuation, road-closure or fishing-ban reporting, placed on the map so the report can be checked against the declared danger areas rather than taken on trust. This is the strongest single indicator in the current assessment.',
    defaultOn: true,
  },
  {
    id: 'itr_social',
    label: 'Reporting volume',
    groupKey: 'itr_feeds',
    // Magenta, used by no other layer or threat category. The count used to
    // take the dominant category's colour, which came out amber — the same
    // yellow as a maritime warning, in the same shape, on top of it.
    color: '#e879f9',
    hint: 'How much open reporting names each site — off by default',
    explain:
      'How many posts name this site. Click it to read them. This counts what is being talked about, so a post that names only a missile and no place is not counted here.',
    // Off by default. It is commentary rather than observation, and it sits on
    // top of the sites, warnings and evacuation markers that are the subject.
    defaultOn: false,
  },
  {
    id: 'itr_thermal',
    label: 'Thermal detections',
    groupKey: 'itr_feeds',
    color: '#fb7185',
    hint: 'Satellite heat detections — off by default; almost all are farm burning',
    explain:
      'A satellite heat detection, sized by how hot it burned. Off by default: every one currently showing is over the Bangladesh and Myanmar coast, hundreds of kilometres from the pad, so the heat reading barely moves the assessment. Switch it on when a detection inside the pad box would matter — that one would be significant.',
    // The densest layer and the least significant. Leaving it on packed 28
    // overlapping dots over the delta and buried the signal underneath.
    defaultOn: false,
  },
  {
    id: 'itr_aircraft',
    label: 'Aircraft',
    groupKey: 'itr_feeds',
    color: '#38bdf8',
    hint: 'Live ADS-B traffic within 500 km, updating every two seconds',
    explain:
      'A live aircraft, coloured by altitude and pointing along its reported track. Fixes land every two seconds and the position is dead-reckoned between them — so the motion is continuous, but at any instant between fixes the position is an estimate from the last reported track and speed. A faded contact has not reported in over thirty seconds.',
    defaultOn: true,
  },
  {
    id: 'itr_imagery',
    label: 'Imagery footprints',
    groupKey: 'itr_feeds',
    color: '#4ade80',
    hint: 'Recent optical scenes covering the pad, with cloud cover',
    explain:
      'The ground footprint of a recent satellite pass. It shows what has been imaged and how cloudy it was, not what the image contains.',
    defaultOn: false,
  },

  /* ── Cameras ──────────────────────────────────────────────────────────────
   *
   * One layer for every open camera network, rather than one per country. What
   * differs between them is how the picture arrives — live video, stills on a
   * timer, or a link to the provider's own player — and that is drawn on the
   * marker, where it is visible before you click, instead of split across rail
   * rows nobody would think to compare.
   */
  {
    id: 'cctv',
    label: 'Camera feeds',
    groupKey: 'cameras',
    // Cyan-leaning teal, used by no other layer. These are the only clickable
    // markers on the map and they must not be mistaken for a plotted observation.
    color: '#22d3ee',
    hint: 'Public cameras — click a marker to view',
    explain:
      'A camera whose operator publishes it openly. Most are stills on a timer rather than live video, and the marker and viewer both say which. Nothing here is collected by this system and none of it is a private camera — it is context, not an observation of the subject.',
    // Off by default, and this one is not a close call: the dashboard opens on the
    // Odisha coast, where no open camera network exists. On by default would mean
    // an empty layer at first paint, which reads as broken rather than as absent.
    defaultOn: false,
  },

  {
    id: 'terrain',
    label: '3D terrain',
    groupKey: 'display',
    color: '#a3a3a3',
    hint: 'Elevation from a global DEM — tilt the camera to see it',
    explain:
      'Real elevation, drawn at true scale rather than exaggerated. It matters here because the pad complex, the Chandipur range and every settlement named in evacuation reporting sit within a few metres of sea level — which is a thing worth being able to see. Off by default: it loads a second set of tiles, and an ocean danger area has no relief to read.',
    // Off by default. It costs a second tile pyramid from a third-party bucket,
    // and most of what this dashboard draws is over water.
    defaultOn: false,
  },
  {
    id: 'day_night',
    label: 'Day / night',
    groupKey: 'display',
    color: '#64748b',
    hint: 'Solar terminator — the shaded half is in darkness now',
    defaultOn: false,
  },
  {
    id: 'graticule',
    label: 'Graticule',
    groupKey: 'display',
    color: '#94a3b8',
    hint: 'Latitude and longitude grid at 30° intervals',
    defaultOn: false,
  },
]

const BY_ID = new Map(DATA_LAYERS.map((layer) => [layer.id, layer]))

export const dataLayer = (id: DataLayerId): DataLayer | undefined => BY_ID.get(id)

export const layerColor = (id: DataLayerId): string => BY_ID.get(id)?.color ?? '#94a3b8'

/** Layers in one group, in declaration order. */
export const layersInGroup = (groupKey: LayerGroupKey): DataLayer[] =>
  DATA_LAYERS.filter((layer) => layer.groupKey === groupKey)

/** Signal layers are the ones that fetch and plot points. */
export const SIGNAL_LAYER_IDS = DATA_LAYERS.filter((layer) => layer.groupKey === 'signals').map(
  (layer) => layer.id,
) as SignalLayerId[]

/**
 * Stacking priority when markers overlap. Higher sits on top.
 *
 * The subject of the dashboard must never be hidden behind context. Thermal
 * detections are the densest layer *and* the least significant — they score
 * 0.05 in the assessment because they are almost all agricultural burning — so
 * they sit at the bottom.
 */
const LAYER_PRIORITY: Partial<Record<DataLayerId, number>> = {
  itr_sites: 400,
  itr_warnings: 300,
  itr_evacuations: 250,
  itr_aircraft: 200,
  // Sits below the sites it is anchored to — it is a count *about* them.
  itr_social: 150,
  itr_thermal: 0,
}

/**
 * Layers whose data is fetched for the current viewport rather than once.
 *
 * Only cameras, so far. Kept as a named list because three places need to know
 * which layers behave this way — the rail row that explains the zoom threshold, the
 * fetch hook, and anything later that wants to show a "loading for this view"
 * state — and a hardcoded `=== 'cctv'` in each would drift.
 */
export const VIEWPORT_LAYER_IDS: DataLayerId[] = ['cctv']

export const layerPriority = (id: DataLayerId): number => LAYER_PRIORITY[id] ?? 100

export const DEFAULT_LAYER_STATE: Record<DataLayerId, boolean> = Object.fromEntries(
  DATA_LAYERS.map((layer) => [layer.id, layer.defaultOn]),
) as Record<DataLayerId, boolean>
