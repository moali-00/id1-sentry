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
 * Operator-created watches and the generic demo signal layers are switched off:
 * the ITR target is the sole subject for now.
 *
 * A flag rather than a deletion — every watch component, reducer and fixture is
 * still wired, so flipping this back restores the rail group, the create/edit
 * form and the four demo signal layers with no other change.
 */
export const WATCHES_ENABLED = false

const ALL_GROUPS: { key: LayerGroupKey; label: string }[] = [
  // The rail's own header already reads LAYERS — a group called
  // "WATCHES · LAYERS" underneath it just said the same word twice.
  { key: 'watches', label: 'WATCHES' },
  { key: 'signals', label: 'SIGNALS' },
  { key: 'itr_zones', label: 'ZONES' },
  { key: 'itr_feeds', label: 'FEEDS' },
  { key: 'display', label: 'DISPLAY' },
]

/**
 * `watches` always renders — it holds the ITR target row, which is not an
 * operator watch. Only the generic demo signal layers go with the flag.
 */
export const LAYER_GROUPS = ALL_GROUPS.filter((group) => WATCHES_ENABLED || group.key !== 'signals')

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
    hint: 'ADS-B vacancy watch box across the Kolkata FIR approaches',
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
    hint: 'Where each declared trial is aimed — a wedge on the warning’s own bearing and range',
    explain:
      'The wedge a warning’s own geometry describes, drawn from the launch site. A narrow arc is a real bearing; a wide one covers more map while revealing far less, and is drawn faint and dashed to say so.',
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
      'Airspace closed by NOTAM. Where the shape is approximated from a centre and a radius it is drawn dashed, because the boundary is this service’s reconstruction rather than the authority’s.',
    defaultOn: true,
  },
  {
    id: 'itr_thermal',
    label: 'Thermal detections',
    groupKey: 'itr_feeds',
    color: '#fb7185',
    hint: 'FIRMS VIIRS/MODIS hotspots, sized by fire radiative power',
    explain:
      'A satellite heat detection, sized by fire radiative power. Most are agricultural burning; only one inside the pad box would indicate a launch.',
    defaultOn: true,
  },
  {
    id: 'itr_aircraft',
    label: 'Aircraft',
    groupKey: 'itr_feeds',
    color: '#38bdf8',
    hint: 'Live ADS-B contacts inside the airspace watch box',
    explain:
      'A live ADS-B contact. The arrow points along its reported track and the dashed leader projects five minutes ahead — a heading, not a predicted flight path.',
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

export const DEFAULT_LAYER_STATE: Record<DataLayerId, boolean> = Object.fromEntries(
  DATA_LAYERS.map((layer) => [layer.id, layer.defaultOn]),
) as Record<DataLayerId, boolean>
