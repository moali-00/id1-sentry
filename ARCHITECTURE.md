# Sentry Dashboard — how the code is put together

A walkthrough of the codebase for someone who has to work on it. The
[README](./README.md) covers _what the product does and how to run it_; this
covers _what exists in the source tree and why_.

Nothing here is aspirational — every file, type and function named below is in
the repo today.

---

## 1. The shape of the thing

One full-bleed MapLibre GL map, with floating panels ("chrome") layered over it,
and routed slide-over panels layered over those.

```
MapProvider                        holds the MapLibre instance
└── div.relative.h-full
    ├── <MapCanvas />              <Map> + every layer as a child component
    ├── <MonitoringChrome />       all floating panels
    └── <Outlet />                 routed detail panels (target / site / watch)
```

That is `src/layouts/main_layout.tsx` in full. The map is mounted **once** and
never unmounts — panels appear and disappear around it, so camera state and tile
cache survive navigation.

### Why a provider rather than just a hook

`MapCanvas` renders react-map-gl's `<Map>` and hands the instance up through
`onReady`; `MapProvider` holds it and exposes it through React context
(`MapContext`). That inversion — canvas creates, provider holds — exists because
the chrome needs the map too, and the chrome is not a child of `MapCanvas`: the
search bar flies to a result, the zoom buttons zoom, the coordinate readout
tracks the cursor.

The handoff comes from **the map's ref, not its `load` event**. `load` fires once,
and under StrictMode's mount → unmount → remount it can be missed entirely, which
would leave `map` null forever — no layer, marker or control ever binds, and the
map renders as an empty canvas with nothing to show for it. A ref fires on every
mount. The cost is that `map` is non-null before the style is ready, so anything
needing a loaded style checks for one.

react-map-gl ships its own `useMap()`, but it only resolves for components
_inside_ `<Map>`. Keeping our own context means the chrome does not have to move
into the map's subtree to reach the instance.

```ts
interface MapController {
  map: MapLibreMap | null // null until constructed; style may still be loading
  onReady: (map: MapLibreMap | null) => void
  flyTo: (lat, lng, options?) => void // options carry zoom, duration, pitch, bearing
  zoomIn: () => void
  zoomOut: () => void
}
```

**`flyTo` takes seconds; MapLibre takes milliseconds.** The conversion is in
`MapProvider` — the callers all predate the migration and were left alone.

---

## 2. Directory map

```
src/
├── api/            data in — one module per backend surface
├── components/
│   ├── ui/         generic primitives, no domain knowledge
│   └── monitoring/ domain components
│       ├── layers/  one component per map layer
│       └── markers/ the DOM markers those layers place
├── data/           bundled fixtures (seed.ts, signals.ts, sentiry/*.json)
├── hooks/          map-state + behaviour hooks
├── layouts/        the single root layout
├── pages/          routed slide-over panels
├── routes/         router definition
├── store/          Redux Toolkit slices + typed hooks
├── types/          two type modules — see below
└── utils/          pure functions: adapters, geometry, formatting, registries
```

The folder layout deliberately mirrors `apps/frontend` in the origin monorepo,
so the two apps navigate the same way.

### The two type modules — the most important distinction in the codebase

| module                | contains                                           | who owns the shape |
| --------------------- | -------------------------------------------------- | ------------------ |
| `types/sentiry.ts`    | **wire shapes** — exactly what the backend returns | the backend        |
| `types/monitoring.ts` | **view models** — what the map and panels render   | us                 |

`utils/sentiryAdapters.ts` is the only bridge between them. Nothing in
`components/` imports from `types/sentiry.ts` except where it renders a raw
field verbatim.

This matters because the backend's shapes are awkward for rendering (GeoJSON
ordering, nullable scores, several different envelope conventions) and the map's
shapes are awkward for a backend (`size` in pixels, marker `zIndex`
ordering). Keeping them apart means a backend change lands in one file.

---

## 3. Objects we defined

### View models — `types/monitoring.ts`

| type          | what it is                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `CategoryKey` | `'political' \| 'military' \| 'conflict' \| 'unrest' \| 'infra'` — drives every colour swatch       |
| `Watch`       | a standing query. Operator-created; currently disabled (see §8)                                     |
| `Cluster`     | a numbered circle on the map: `{ lat, lng, count, size, category, watchId }`                        |
| `FeedItem`    | one row in the activity rail                                                                        |
| `Post`        | one source post, as rendered by `PostCard`                                                          |
| `WatchDetail` | the payload behind a watch's detail panel                                                           |
| `DataLayer`   | a registry entry: `{ id, label, groupKey, color, hint, explain?, defaultOn }`                       |
| `MapPoint`    | a plotted point: `{ lat, lng, label, severity?, bearingDeg?, speedMs?, altitudeM? }`                |
| `MapArea`     | a closed polygon: `{ ring: [lon,lat][], dashed?, emphasis?, baseM?, heightM? }`                     |
| `MapLine`     | an open path — **not** a polygon, because filling it would assert an area the data doesn't describe |
| `GeoResult`   | a search-bar result row                                                                             |
| `WatchDraft`  | the create/edit form model                                                                          |

Four of these carry design decisions worth knowing:

- **`MapArea.emphasis`** (0–1) scales stroke weight and fill opacity. Routine
  range activity is in force for weeks and would be on the map whether or not a
  test were coming, so it recedes; a declared launch trial draws at full
  strength. Without it every warning looked equally important.
- **`MapArea.baseM` / `heightM`** are the published vertical extent, and are set
  **only** where the authority declared one — `utils/altitude.ts` returns null for
  `UNL` and for anything it cannot parse. An area without them draws flat rather
  than extruded to a guessed ceiling. Every danger area in the current capture is
  `SFC`–`UNL`, so nothing extrudes from the bundled fixtures today.
- **`MapLine` exists separately from `MapArea`** for exactly one reason: a
  launch-to-impact arc encloses nothing. It also stays _on the ground_ — the data
  gives a launch corridor and an impact zone with no apogee between them, so a
  lifted trajectory would be an invention.
- **`FeedItem.focus`** is set _only_ when an item names a place. Most social
  posts name a missile and no location, and inventing a position for those would
  be a fabrication — so those rows have no fly-to and no marker.

### Wire shapes — `types/sentiry.ts`

47 interfaces mirroring the `/v1/*` responses. The ones that caused bugs and are
worth reading before you touch them:

- **`MissileRef`** — wherever the API points at a weapon system it sends an
  object `{ key, name, category, range_km }`, never a bare string. Typing it as
  `string[]` crashed React with _"Objects are not valid as a React child"_.
- **`AssessmentIndicator.score`** is `number | null`. `airspace_vacancy` is
  currently `null`, and typing it `number` produced `NaN` bar widths.
- **`SourceHealth.status`** includes `'empty'` — a feed that answered correctly
  with nothing to report. That is the opposite of `'error'` and must not be
  counted as down.
- **`SocialCall.status`** is `'ok' | 'empty' | 'error'`. `empty` is a successful
  query that found nothing (a negative observation); `error` is a blind spot.
  Only the former is evidence.

### Registries — `utils/`

Not types, but the closest thing to configuration objects:

- **`utils/layers.ts`** — `DATA_LAYERS`, the list of every map layer with its
  colour, hint, hover explanation and default state. Also `LAYER_GROUPS` (rail
  grouping), `layerPriority()` (marker stacking) and `WATCHES_ENABLED`.
- **`utils/constants.ts`** — `CATEGORIES`, `BASEMAPS`, `PROJECTIONS`,
  `VIEW_PRESETS`, `INITIAL_VIEW`, `SKY`, zoom and pitch limits, terrain settings.
- **`utils/levels.ts`** — assessment level → colour.
- **`utils/mapLayers.ts`** — the ids of the MapLibre sources and layers we add.
  Named in one place because they are referenced from three directions — the
  `<Layer>` that defines them, `interactiveLayerIds`, and `queryRenderedFeatures`
  — and a typo in any one fails silently.
- **`utils/mapStyle.ts`** — basemap → a MapLibre style, vector URL or hand-built
  raster document.

---

## 4. How data gets in

### Two independent data sources

| source                           | endpoints             | slice                            | fixture                              |
| -------------------------------- | --------------------- | -------------------------------- | ------------------------------------ |
| **Sentiry** — the ITR target     | `/v1/*`, 19 endpoints | `itrSlice`                       | `src/data/sentiry/*.json` (49 files) |
| **Monitoring** — generic watches | `/monitoring/*`       | `monitoringSlice`, `layersSlice` | `src/data/seed.ts`, `signals.ts`     |

Only the first is live in the product today.

### The fixture switch

Every API function has the same shape:

```ts
export function fetchAoi(options?: RequestOptions): Promise<AoiResponse> {
  if (!hasApi()) return fixture<AoiResponse>(aoiCapture)
  return request<AoiResponse>('/v1/aoi', options)
}
```

`hasApi()` is simply `env.apiBaseUrl.length > 0`. With `VITE_API_BASE_URL` unset
the app runs entirely from bundled captures and is fully demoable with no
backend. The captures are the **verbatim recorded responses**, so an adapter
written against a fixture works unchanged against the live API.

**Refreshing demo data is a re-capture and a file copy — no code changes.**

### Three envelope conventions (this has bitten us)

The captures were recorded by different harnesses, so there are three unwrapping
paths in `api/sentiry.ts`:

```ts
// 1. Most captures: payload under `response`
function fixture<T>(capture: { response: unknown }): Promise<T>

// 2. Connector captures: payload under `data`
function connectorFixture<T>(capture: unknown): Promise<T>

// 3. social_posts.json: no envelope at all, the payload IS the top-level object
const capture = await import('@/data/sentiry/social_posts.json')
return capture.default
```

Reading the wrong key yields `undefined` rather than throwing, which is why they
are three named helpers rather than one clever one.

### Code-splitting the big fixture

`social_posts.json` is 900 kB. It is loaded with a dynamic `import()` so Rollup
gives it its own chunk (~700 kB, 131 kB gzipped) instead of putting it in the
main bundle. `social_media_image_urls.json` does the same.

### The load

`useItrData()` fires one thunk on mount:

```ts
export const loadItr = createAsyncThunk('itr/load', async (_, { signal }) => {
  const [...] = await Promise.allSettled([ /* 19 fetches */ ])
  // failures are collected into `failed[]`, not thrown
})
```

`allSettled`, not `all` — the capture already contains feeds that legitimately
degrade or error (news reporting was rate-limited when it was taken). One bad
upstream must not blank the other eighteen. The slice only reports `status:
'error'` if _all_ nineteen fail.

---

## 5. From wire shape to pixels

The pipeline is the same for every feed:

```
api/sentiry.ts  →  itrSlice  →  utils/sentiryAdapters.ts  →  layers/*.tsx  →  MapLibre
   (fetch)         (store)         (adapt)                     (render)
```

Adapters are **pure functions**, so they are the easy place to reason about and
to check by hand. Selected examples:

| adapter                          | produces                                       |
| -------------------------------- | ---------------------------------------------- |
| `aoiZones(aoi)`                  | the four AOI boxes as `MapArea[]`              |
| `sitePoints(aoi)`                | island + secondary complex as `MapPoint[]`     |
| `warningPoints` / `warningAreas` | maritime warnings, centroid and boundary       |
| `corridorAreas(warnings)`        | declared launch corridors                      |
| `coupledLines(pairs, origin)`    | launch→impact great-circle arcs as `MapLine[]` |
| `evacuationPoints(places)`       | geocoded settlements                           |
| `socialClusters(posts, sites)`   | reporting counts as `Cluster[]`                |
| `socialPostFeedItems(...)`       | posts as activity-feed rows                    |
| `socialPostDetails(...)`         | posts as `Post[]` for `PostCard`               |

Derived state lives in memoised selectors on `itrSlice`:
`selectItrPoints`, `selectItrAreas`, `selectItrLines`, `selectItrFeedItems`,
`selectSocialClusters`, `selectSocialSiteDetails`, `selectTargetSummary`,
`selectAllSources`.

> **The frontend performs no scoring.** The assessment score, level, confidence
> and every indicator value are computed by the backend and rendered verbatim.
> The only arithmetic in the app is marker sizing.

### One adapter worth reading before editing

`corridorAreas()` draws each warning's own published `positions` verbatim. An
earlier version synthesised a wedge from `{bearing_deg, bearing_span_deg,
near_km, far_km}` — and when a declared polygon _wraps around_ the launch site,
the angular spread measured from that origin comes out near 240°. Sweeping a
sector across it painted a fan over India, Sri Lanka, Myanmar and Indonesia:
30.6M km² against the 2.3M km² actually declared. **Draw what the authority
published; use the corridor figures only as description.**

---

## 6. Rendering MapLibre from React

**React is the reconciler.** Every layer is a component under `<Map>`; there is no
ref-keyed bookkeeping, no create/destroy/visibility/appearance effect chain, and
nothing to tear down on a StrictMode remount. That replaced roughly 500 lines of
imperative Leaflet reconciliation, and took three long-standing workarounds with
it — see the end of this section.

| component                             | renders                                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `PointMarkers`                        | `MapPoint[]` — DOM `<Marker>`s, zoom-scaled                                               |
| `ClusterMarkers` / `ReportingMarkers` | `Cluster[]` — numbered circles / solid pills                                              |
| `AreaLayers`                          | `MapArea[]` — a `geojson` source with fill, outline, dashed outline, and extrusion layers |
| `LineLayers`                          | `MapLine[]` — solid and dashed line layers                                                |
| `DayNightLayer`                       | solar terminator, from `utils/solar.ts`                                                   |
| `GraticuleLayer`                      | lat/lon grid, built once at module scope                                                  |

### DOM markers, GL geometry

The split is deliberate and worth keeping.

**Points and clusters are DOM markers.** The counts are in the low hundreds, so
the cost is irrelevant, and DOM buys things a sprite-based symbol layer cannot do
without pre-rendering an image per state: CSS keyframes (`sentry-ping` on the
monitored sites, `sentry-bloom` on a fresh cluster), the hatched gradient that
marks an inferred position, and an SVG arrowhead rotated to a compass bearing.

**Areas and lines are GeoJSON sources.** One source and a handful of layers serve
_all twenty_ data layers, because colour, stroke weight and opacity are read from
each feature's own properties by paint expressions. `utils/geojson.ts` exists for
exactly that: it copies the style inputs onto `properties`. Resolving
`layerColor()` per feature at render time would instead mean twenty MapLibre
layers each with its own source.

Two constraints show through in the layer list:

- **`line-dasharray` takes no data-driven expression.** A dashed and a solid
  outline therefore cannot share one layer however alike the rest of their paint
  is — hence the `-dashed` twins, filtered on the `dashed` property.
- **Only outlines are interactive, never a fill.** A filled polygon that answered
  to the cursor would swallow every point inside it, and every AOI box encloses
  the markers that matter.

### Stacking is explicit

MapLibre draws in layer order, and DOM markers carry a real `zIndex` — so the old
`bringToBack()` inversion is gone. Markers use the same numbers the Leaflet
`zIndexOffset`s did: reporting pills at −600, points at −500 + `layerPriority()`,
watch clusters at 0 and 100 when hovered. The subject of the dashboard must never
be hidden behind context.

### Hover

A DOM marker has an element to attach a listener to. A GL feature does not, so
`useFeatureHover` queries the rendered frame at the cursor. Two details matter:
it filters to layers that **currently exist** (a basemap swap replaces the style,
and `queryRenderedFeatures` throws on an unknown layer id), and it anchors the
tooltip to the **cursor** rather than the feature — a danger area can be 3,800 km
across, and a tooltip pinned to its centroid would appear somewhere the operator
is not looking.

### Three gotchas encoded in the code

1. **Tailwind v4 utilities live in `@layer utilities`**, and unlayered CSS beats
   them regardless of specificity. MapLibre sets `.maplibregl-map { position:
relative }` unlayered, which silently overrides `absolute inset-0` and
   collapses the map to zero height with no error — this sank the first attempt at
   this migration. `MapCanvas` therefore has **two nested elements**: Tailwind
   positions the wrapper, and the map container inside takes its size from an
   inline style. Every MapLibre override in `index.css` is plain unlayered CSS for
   the same reason.
2. **Switching basemap replaces the whole style**, and a replaced style has no DEM
   source and no terrain. `useTerrain` is imperative and re-applies itself on
   `style.load` precisely because of this.
3. **Terrarium is not the DEM default.** The spec default is `mapbox`, and reading
   terrarium tiles as Mapbox RGB yields elevations that look plausible and are
   wrong. The encoding is declared explicitly.

### Markers

`components/monitoring/markers/` holds `ClusterMarker`, `PointMarker` and
`ReportingMarker` as JSX. They used to be `divIcon` HTML strings — the one place
in the app that composed styles by hand, because Tailwind's scanner cannot see
inside a `divIcon`. As components they are ordinary React, and `escapeHtml()` went
with them: the tooltip is JSX now, so React escapes the backend prose it renders.

Sizes and hues stay inline styles, because they are _values_ — a diameter from
`Cluster.size`, a hue from the threat category. `utils/markerGeometry.ts` holds
the pixel figures that a marker and the `<Marker>` positioning it both need to
agree on.

---

## 7. State

Four slices, all Redux Toolkit with the `selectors` block style:

| slice             | owns                                                                     |
| ----------------- | ------------------------------------------------------------------------ |
| `itrSlice`        | every Sentiry feed + all derived map/feed selectors                      |
| `monitoringSlice` | watches, clusters, feed, rail open/closed, hover/selection               |
| `layersSlice`     | per-layer on/off, group expansion, basemap, lazily-fetched signal points |
| `themeSlice`      | light/dark                                                               |

Typed hooks in `store/store.ts` — always use `useAppSelector` / `useAppDispatch`,
never the raw `react-redux` exports.

**Theme is a listener, not a reducer.** The DOM class swap and the
`localStorage` write live in `store/themeListener.ts`, because reducers must
stay pure.

---

## 8. Components

### `components/ui/` — reusable, zero domain knowledge

These are the ones to reach for when building anything new:

| primitive                                                    | notes                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `Panel`, `PanelHeader`, `PanelTitle`                         | the frosted floating surface every panel is built from                                      |
| `IconButton`                                                 | sizes `sm` (22px, default) / `md` (26px) / `lg` (34px)                                      |
| `FieldLabel`                                                 | the small uppercase section heading                                                         |
| `Chip`                                                       | small pill                                                                                  |
| `Badges` → `PlatformBadge`, `SuggestedTag`, `CategorySwatch` | `PlatformBadge` maps long platform names to 2–4 char codes so they don't push the row apart |
| `ConfidenceMeter`                                            | 0–5 segmented bar                                                                           |
| `Spinner`                                                    |                                                                                             |

### `components/monitoring/` — domain components

Grouped by role:

**Composition roots**
`MonitoringChrome` (mounts every floating panel and owns popover/modal state),
`LeftColumn` (layer rail + legend), `MapCanvas`, `MapProvider`.

**Map chrome**
`StatusPill`, `CommandBar`, `SearchBar`, `ViewPresets`, `DisplayPanel`,
`SharePanel`, `ShortcutsOverlay`, `ZoomControls` (zoom plus a compass that appears
only when the camera leaves north-up), `CoordinateReadout`, `Legend`. The scale bar
is MapLibre's own `ScaleControl`, mounted inside `<MapCanvas />`.

`CommandBar` owns one popover at a time — `presets` (`P`), `display` (`D`) or
`share` (`S`) — with the state held in `MonitoringChrome`.

**Layer rail**
`LayerRail`, `LayerGroupSection` (collapsible group with `n/N` count),
`LayerRow`, `WatchRow`, `TargetWatchRow`.

The rail renders **data layers only**. `DisplayPanel` owns PROJECTION (flat/globe),
BASEMAP, a SCOPE button that pulls the camera out to the whole world, and the three
cartographic overlays. All of those answer _how the map is drawn_ rather than _what
is on it_ — which is also why none of them sit in `ViewPresets`: every entry there
is a place an analyst jumps to, and "the globe" is not a destination.

`LAYER_GROUPS` filters `display` out for that reason, while `DATA_LAYERS` keeps its
three overlays registered — the registry, the URL's `layers=` list and
`layerEnabled` all still know about them, so `DisplayPanel` renders them with the
same `LayerRow` the rail uses.

**`Globe` and `World` are not the same control**, despite reading alike: `Globe`
(PROJECTION) draws the earth as a sphere, `World` (SCOPE) moves the camera back
until the whole planet is in frame. They compose — a globe at z14 over the pad looks
flat because you are too close to see curvature, and a flat Mercator world view puts
Greenland above Africa in size. The names were `Global` and `Globe` until that
proved impossible to tell apart at a glance.

**Content**
`ActivityFeed`, `FeedRow`, `PostCard`, `AssessmentStrip`, `SourceHealthPanel`.

**Watch authoring** (present but dormant — see below)
`WatchFormModal`, `RegionPicker`.

### `WATCHES_ENABLED`

`utils/layers.ts` exports `export const WATCHES_ENABLED = false`.

Operator-created watches and the four generic demo signal layers are switched
off, because the ITR target is the sole subject. It is **a flag, not a
deletion** — every watch component, reducer, fixture and form is still wired, so
flipping it back restores the rail group, the create/edit modal and the demo
layers with no other change.

---

## 9. Routing

`react-router-dom`, four routes, all rendering into the layout's `<Outlet />`:

| path              | page                | shows                   |
| ----------------- | ------------------- | ----------------------- |
| `/`               | —                   | just the map and chrome |
| `/target`         | `target_detail.tsx` | the full ITR dossier    |
| `/site/:siteId`   | `site_detail.tsx`   | posts naming one site   |
| `/watch/:watchId` | `watch_detail.tsx`  | a watch's topic panel   |
| `*`               |                     | redirect to `/`         |

Routing rather than component state means a link opens straight into a panel and
Back closes it.

**Cold deep links must wait for data.** `/site/:id` and `/target` both check
`status === 'loading'` before redirecting away — otherwise a shared link bounces
to the map before the feeds land.

The camera and active layers are mirrored into the query string
(`?lat=&lon=&zoom=&layers=`) by `useMapUrlState`, so a URL carries the whole view
alongside the path.

---

## 10. Styling

Colours are declared **once** in `src/index.css` as `--c-*` pairs — light on
`:root`, dark on `.dark` — and mapped to Tailwind via `@theme inline`. So
`bg-panel` follows the theme with no JavaScript. **Dark is the default.**

Components use tokens (`bg-panel`, `text-fg-muted`, `border-line`) and never raw
hex, with two deliberate exceptions — both cases where a hue is needed as a
_value_ rather than as a class:

1. **Marker inline styles.** Category and layer hues are fixed across themes, so
   the legend stays learnable, and a diameter comes from `Cluster.size`.
2. **MapLibre paint expressions**, which read `['get', 'color']` off a feature and
   cannot reference a Tailwind class at all.

Two tokens exist to stop a specific mistake:

- **`--c-accent-fg`** — text on an accent fill. Dark in the dark palette, white in
  light. `text-white` on the cyan accent fails contrast, and the accent fills every
  active segment, ON pill and primary button.
- **`--color-on-bright`** — text on one of the fixed bright status hues, which have
  the same contrast problem in both palettes.

Type has one micro-label (`label-micro`: mono, uppercase, letterspaced) shared by
every section heading and field caption, and one `numeric` utility for any figure
that changes in place. Both replaced several hand-rolled near-duplicates.

The **basemap is separate from the theme** — three keyless CARTO vector styles and
one Esri raster in `BASEMAPS`, picked from the DISPLAY popover (`D`). Marker
contrast follows the basemap, not the chrome theme, because markers are drawn on
tiles rather than on panels. So does **area fill opacity**: `DARK_FILL_SCALE` in
`AreaLayers` cuts it to 45% over a dark basemap, because the AOI boxes nest four
deep and warm low-alpha fills that read as a pale tint over Voyager compound into
an olive-brown wash over near-black.

**The sky is the exception.** `SKY` follows the _chrome_ theme, because the
atmosphere around a globe is space, not part of the map.

**MapLibre's own CSS is overridden unlayered** at the bottom of `index.css` — see
§6 gotcha 1 for why that is not optional.

Custom utilities in `index.css`: `scroll-thin`, `panel-surface`, `animate-rise`,
`animate-pulse-live`, plus the `sentry-bloom` / `sentry-ping` keyframes. All
animation is disabled under `prefers-reduced-motion`.

---

## 11. Build and deploy

**Stack:** React 19, Vite 7, TypeScript 5.9, Tailwind v4, Redux Toolkit,
React Router 7, MapLibre GL **5** via react-map-gl 8, pnpm.

> ### Do not upgrade `maplibre-gl` to 6.x
>
> **v6 renders a completely blank map here, with no error of any kind.** It ships
> ESM-only, with the tile worker as a separate `maplibre-gl-worker.mjs`, and that
> worker does not come up under our Vite setup. MapLibre fetches and decodes
> vector tiles _inside_ that worker, so when it is dead you get: the style JSON
> parsed, all 98 layers registered, sources present, the canvas correctly sized,
> WebGL alive — and **zero tile requests**, `isStyleLoaded()` false forever, and an
> empty canvas. Nothing throws. Our own GeoJSON layers and DOM markers also
> vanish, because GeoJSON is parsed in the same worker.
>
> react-map-gl 8.1.2 targets v5 (`>=1.13.0` in its peer range is not a statement
> of support), and v5.24 is what Aegis ships. v5 has globe projection, terrain,
> sky and fill-extrusion — everything this app uses. There is nothing to gain from
> v6 and a silent blank map to lose.
>
> If a future upgrade is attempted, the tell is the network panel: if no `.mvt`
> requests appear, it is the worker, not your code.

```bash
pnpm install
pnpm dev          # :5175
pnpm typecheck    # tsc -b --noEmit
pnpm lint
pnpm build        # tsc -b && vite build
pnpm preview      # :4175
```

`vite.config.ts` splits vendor code into cacheable chunks —
`vendor-maplibre`, `vendor-react`, `vendor-router`, `vendor-redux` — so the app
chunk stays small across deploys. Terser drops `console` and `debugger`.

**MapLibre is by far the largest thing in the build** — around 985 kB raw, 254 kB
gzipped, against Leaflet's 42 kB. That is the price of a GL engine and there is no
smaller way to get a globe, terrain and vector tiles; it gets its own chunk and its
own cache lifetime. `chunkSizeWarningLimit` is 1100 to suit it.

**SPA rewrites** are configured three ways so any host works:
`public/_redirects` (Netlify / Cloudflare), `vercel.json` (Vercel),
`netlify.toml` (which also pins `publish = "dist"` — without it Netlify served
the repo root and the site rendered blank).

**`VITE_*` values are baked in at build time as string literals.** Changing
`.env` after a build has no effect; you must rebuild. No environment variables
are required — with all of them unset the app runs from fixtures.

---

## 12. Conventions worth keeping

- **Everything is `[lon, lat]`, and nothing is ever flipped.** GeoJSON order is
  both what the API sends and what MapLibre draws, so `MapArea.ring`,
  `MapLine.path` and every `utils/geodesy.ts` return value are all `[lon, lat]`.
  `MapPoint` keeps named `{ lat, lng }` fields, where there is no order to get
  wrong. This used to be a flip in `sentiryAdapters.ts`; under Leaflet it had to
  be, and it is worth not reintroducing — TypeScript cannot catch a swapped tuple.
  (The one that got through the migration was `greatCircle`, whose type annotation
  changed while its `push` did not.)
- **Adapters are pure.** No fetching, no `Date.now()` inside a map callback —
  `now` is injected so a batch of rows stays internally consistent.
- **Don't invent positions, and don't invent heights.** A post with no place name
  gets no marker. A danger area whose ceiling is `UNL` draws flat rather than
  extruded. An impact arc stays on the ground, because the data has no apogee.
  Terrain exaggeration is 1.0.
- **Distinguish "we looked and found nothing" from "we couldn't look."**
  `empty` vs `error` in both `SourceHealth` and `SocialCall`; a hatched bar for
  an unobserved indicator rather than an empty one.
- **No service plumbing in the interface.** `plainText()` in `utils/format.ts`
  strips endpoint paths, HTTP error bodies and vendor support addresses out of
  prose that arrives inside the payload — the assessment sometimes ends a
  sentence with an instruction to poll an endpoint.
- **English only.** No language filter, no original/translation split
  (`Post.text` is the single body field), no RTL handling; the geocoder is asked
  for `accept-language=en`.
