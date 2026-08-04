# Sentry Dashboard

Standalone geospatial live-monitoring surface for OSINT watches. A full-bleed
MapLibre GL map is the product — flat, globe, satellite or 3D terrain; the layer
rail, the activity feed, the command bar, the legend and the topic detail panel
float over it as chrome.

Previously lived inside `apps/frontend` as `src/pages/monitoring/`. It is now its
own app: it shares no state with the main frontend, needs no authentication, and
deploys independently.

```bash
pnpm install
pnpm dev          # Vite dev server on :5175
pnpm build
pnpm lint
pnpm typecheck
```

Standalone SPA — no backend required. It renders from the captured Sentiry
responses bundled in `src/data/sentiry/`; set `VITE_API_BASE_URL` to point it at
a live API instead.

## Deploying

A static SPA — build once, serve `dist`. No backend and no environment
variables are required: the dashboard renders the captured Sentiry API
responses bundled in `src/data/sentiry/`.

| Host                       | Config              | Notes                                                                              |
| -------------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| Vercel                     | `vercel.json`       | Rewrites every path to `index.html` so `/target` and `/watch/:id` reach the router |
| Netlify / Cloudflare Pages | `public/_redirects` | Same rewrite, different file                                                       |
| GitHub Pages               | —                   | Needs `base: '/<repo>/'` in `vite.config.ts` and a `404.html` copy of `index.html` |

It still reaches the public internet at runtime for map tiles
(`basemaps.cartocdn.com`, `server.arcgisonline.com`) and place search
(`nominatim.openstreetmap.org`), so it will not work behind a strict egress
firewall. Point `VITE_MAP_TILE_URL_*` and `VITE_GEOCODER_URL` at internal hosts
for that case.

## Stack

React 19, Vite 7, Tailwind CSS v4, React Router 7, Redux Toolkit, MapLibre GL 5
via react-map-gl 8. Managed by **pnpm**.

> **`maplibre-gl` is pinned to 5.x on purpose — do not bump it to 6.** v6 is
> ESM-only with a separate tile worker that does not start under our Vite setup,
> and MapLibre decodes vector tiles inside that worker. The result is a blank map
> with no error at all: no tile requests, no basemap, and no markers either. See
> [ARCHITECTURE.md §11](ARCHITECTURE.md) for the full symptom list.

## Layout

Deliberately the same layer-based layout as `apps/frontend`, so moving between
the two apps costs nothing.

```
src/
  App.tsx       composition root — error boundary, store provider, router
  main.tsx      entry point
  api/          client + endpoint modules (the only place that knows about HTTP)
  components/
    monitoring/ the dashboard's components + the map provider/context
      layers/   one component per map layer (areas, lines, markers, graticule,
                day/night) — declarative <Source>/<Layer>/<Marker>
      markers/  the DOM markers those layers place
    ui/         presentational primitives (Panel, Chip, IconButton, …)
    ErrorBoundary.tsx
  data/         seed corpus, the keyword-import dataset, signal-layer fixtures
  hooks/        map hooks (useMapUrlState, useMapZoom, useMapCamera,
                useFeatureHover, useProjectionPitch, useTerrain) and
                session hooks (useLivePoll, useSignalPoints,
                useKeyboardShortcuts, useWatchDraft, useEscapeKey)
  layouts/      main_layout — the full-bleed map shell with an <Outlet />
  pages/        routed views — watch_detail, route_error
  routes/       router definition
  store/        store + typed hooks, slices/, themeListener
  types/        shared domain model
  utils/        pure helpers — constants, layers, env, cn, colour, format,
                mapStyle, geojson, mapLayers, markerGeometry, solar, altitude,
                geodesy, buildWatch, watchDraft
```

## Layers

The left rail lists everything drawn on the map, in collapsible groups
declared in [src/utils/layers.ts](src/utils/layers.ts):

| Group       | Contents                                                                     |
| ----------- | ---------------------------------------------------------------------------- |
| `watches`   | the operator's own standing queries — created, edited, toggled here          |
| `signals`   | global incidents, earthquakes, live news, maritime — plotted points          |
| `itr_zones` | the four nested AOI boxes from `/v1/aoi` — pad, range, airspace, downrange   |
| `itr_feeds` | everything watching the ITR target — sites, warnings, corridors, aircraft, … |

Watches live in `monitoringSlice` because they are domain objects with their own
lifecycle; the rest are catalogue data in `layersSlice`. Signal layers fetch
lazily, the first time each is switched on.

## Keyboard and deep links

`?` lists every shortcut; the sheet is generated from the same table the handler
uses, so the two cannot drift.

The query string mirrors the camera and the layer selection
(`?lat=&lon=&zoom=&layers=`, plus `proj=`, `pitch=` and `bearing=` when the view is
a globe or off level) alongside the existing `/watch/:watchId` path, so a copied
link reopens the whole picture — view, layers and open topic. The Share button
copies it.

## Getting to a location

Four routes to the same place, in the order the search bar tries them:

| Input                                | Resolved by                                              |
| ------------------------------------ | -------------------------------------------------------- |
| `24.86, 67.00` (decimal degrees)     | locally, no network                                      |
| a watch name                         | locally, from the store                                  |
| `Karachi`, `Bosphorus`, `Suez Canal` | [src/api/geocode.ts](src/api/geocode.ts)                 |
| the REGION PRESETS button, or `P`    | `VIEW_PRESETS` in [constants.ts](src/utils/constants.ts) |

**Only one region is live.** `VIEW_PRESETS` marks Abdul Kalam Island with `live:
true` because it is the only one with feeds behind it; the rest are dimmed and carry
no indicator. They stay clickable on purpose — looking at a region we do not monitor
is reasonable, being misled about whether it is monitored is not, and an unexplained
empty map reads as a broken one.

Place-name search prefers the API's `/geocode` once `VITE_API_BASE_URL` is set,
and falls back to a Nominatim-compatible endpoint (`VITE_GEOCODER_URL`,
defaulting to OpenStreetMap's public instance) so it works before the backend
lands. Zoom is derived from each result's bounding box, so a country lands at
z4 and a landmark at z12 rather than everything sharing one zoom.

Deep links (`?lat=&lon=&zoom=`) work regardless of any of the above.

## Basemaps

Four keyless basemaps — three CARTO **vector** styles and one raster — picked from
the DISPLAY popover in the command bar (`D`) and held in `layersSlice`:

| Basemap   | Source             | Kind   | Use                                                             |
| --------- | ------------------ | ------ | --------------------------------------------------------------- |
| Dark      | CARTO Dark Matter  | vector | **default** — the quietest; bright markers carry best over it   |
| Voyager   | CARTO              | vector | most legible: keeps roads, borders and labels at world zoom     |
| Light     | CARTO Positron     | vector | minimal, for dense marker sets                                  |
| Satellite | Esri World Imagery | raster | terrain and infrastructure context; no vector equivalent exists |

The basemap remains **a separate axis from the chrome theme** — a dark UI over the
legible Voyager map is a reasonable thing to want, and the two are only _paired_ by
default, not welded. Two things follow the _basemap_ rather than the theme, because
they are drawn on tiles rather than on panels: **marker contrast**, and **area fill
opacity** (see [Theming](#theming)).

The basemap is also independent of the **projection** — see below.

### Projection and 3D

The **DISPLAY** popover — the sliders button in the command bar, or `D` — holds
everything about _how the map is drawn_: PROJECTION (flat/globe), BASEMAP, a SCOPE
button that pulls the camera out to the whole world, and the terrain / day-night /
graticule overlays.

It sits beside JUMP TO and SHARE rather than in the layer rail, and that is the
point: the rail is a list of _data layers_ — what is drawn on the map — while these
answer _how_. Keeping both in one list also pushed the flat/globe switch below the
fold behind eleven feed rows.

**Two controls, one letter apart, that are not the same thing:** `Globe` under
PROJECTION draws the earth as a sphere; `World` under SCOPE moves the camera back
until the whole planet is in frame. They are independent — you can sit on the pad
at z14 in globe projection, or see the whole world in flat Mercator.

Projection and basemap are two independent axes. A satellite globe, a dark vector
globe and a flat satellite map are all reachable; folding them into one mode dock
would make some combinations unreachable.

None of these live in the REGION PRESETS list, which is **places only**. "The globe"
is not a destination, and neither was the pitched 3D camera on the pad that used to
sit there — that was a second view of the region above it, which is exactly why it
read as out of place.

- **Flat (Web Mercator) is the default**, and is the right projection for the work
  — reading a pad complex at z14, checking a settlement against a declared danger
  area, judging a bearing.
- **Globe** earns its place at world zoom, where Mercator inflates the high
  latitudes enough to misrepresent distance, and where a 3,800 km corridor running
  south into the Indian Ocean is a curve rather than a stripe. Switching to it
  tilts the camera 14° so the sphere reads as one.
- **3D terrain** is a DISPLAY layer, off by default. Real elevation at
  exaggeration 1.0 — see [Honesty](#honesty).
- **Right-drag rotates, ctrl-drag tilts**, to a 75° ceiling. A compass appears in
  the zoom stack once the view leaves north-up, and clicking it restores north.
- The shared-link query string carries `proj`, `pitch` and `bearing` alongside
  `lat/lon/zoom/layers`, so a pitched globe view over the downrange fan restores
  as one rather than as a flat north-up map.

`VITE_MAP_TILE_URL_LIGHT` / `_DARK` switch the Light and Dark basemaps from their
CARTO vector styles to a raster tile template, for air-gapped hosts that serve
plain tiles. `VITE_TERRAIN_URL` does the same for elevation — any replacement must
be **terrarium-encoded**, which is what the reader is configured for.

### Sharpness and zoom feel

- **Vector basemaps.** Labels are glyphs, not baked pixels, so they stay crisp at
  fractional zoom and under a tilted or globe camera. This is what the raster
  tiles could never do; satellite stays raster because imagery has no vector form.
- **Fractional zoom is free.** GL zoom is continuous by nature, so the old
  `zoomSnap: 0.25` workaround is gone. The +/- buttons still step by `ZOOM_DELTA`
  (0.5) rather than a whole level, which MapLibre's built-in control cannot do.
- **`MAX_ZOOM` is 18.** A cap of 12 stops the map at roughly city scale and
  makes it feel like it will not let you in.

> **The Tailwind v4 trap that sank the first attempt at this migration.** Tailwind
> emits its utilities inside `@layer utilities`, and an unlayered rule beats a
> layered one whatever the source order or specificity. MapLibre's stylesheet sets
> `.maplibregl-map { position: relative }` unlayered — so `absolute inset-0` on the
> map container is silently overridden, the map collapses to zero height, and it
> renders blank with no error.
>
> The fix, and the reason [MapCanvas.tsx](src/components/monitoring/MapCanvas.tsx)
> has two nested elements rather than one: Tailwind positions the **wrapper**, and
> the map container inside it takes its size from an **inline style**, which no
> stylesheet can override. The same rule is why every MapLibre override in
> [index.css](src/index.css) is written as plain unlayered CSS.

## Honesty

The dashboard renders what the backend and the source authorities published, and
performs no scoring of its own. Adding a third dimension made that principle
sharper rather than looser, because height is easy to fabricate convincingly:

- **Terrain exaggeration is 1.0.** A dramatised landscape would be the one place
  the frontend editorialised, and it would do it on the layer used to judge whether
  a coastal settlement sits inside a declared danger area.
- **Airspace volumes come only from published limits.** A NOTAM's item F/G pair is
  parsed by [utils/altitude.ts](src/utils/altitude.ts) and the danger area extruded
  to it. `UNL` — no published ceiling — returns null, and the area draws as a flat
  outline rather than being extruded to a number nobody declared. Same for a limit
  string the parser does not recognise: couldn't-read is not zero, the same way
  `SourceHealth`'s `empty` is not `error`.
  > **Note on the current capture:** every danger area in `src/data/sentiry/` is
  > `SFC`–`UNL`, so _nothing extrudes from the bundled fixtures_. The machinery is
  > correct and draws as soon as a feed publishes a finite ceiling. That is the
  > honest outcome, not a bug — see the parser checks for the `UNL → null` case.
- **Launch-to-impact arcs stay on the ground.** `maritime_coupled_trials` gives a
  launch corridor and an impact zone and nothing in between; there is no apogee in
  the data, so lifting the arc into a trajectory would be an invention. It is drawn
  as a great circle on the surface, which is what the two warnings actually assert.
- **Aircraft altitude is carried, not plotted.** `MapPoint.altitudeM` holds the
  reported barometric altitude and the tooltip shows it as a flight level, but the
  marker sits on the ground: MapLibre markers have no altitude API, and faking one
  by screen offset would put a contact somewhere it is not.
- **Markers behind the globe are hidden, not dimmed** (`opacityWhenCovered: 0`). A
  half-visible marker on the far side of the Earth reads as a real detection.
- **Don't invent positions.** A post that names a missile and no place gets no
  marker, and the graticule stops at ±85° rather than claiming a pole.

## Language

The dashboard is **English-only**. There is no language filter, no
original/translation split on a post, and no bidirectional text handling — a
post has one `text` field. Geocoder results are requested with
`accept-language=en` so place names read consistently with the rest of the UI.

## Theming

Both light and dark palettes ship, **dark by default**, paired with the Dark Matter
basemap. Every colour is declared once in [src/index.css](src/index.css) as a
`--c-*` pair (light on `:root`, dark on `.dark`) and exposed to Tailwind through
`@theme inline`, so a class like `bg-panel` follows the theme with no JS and no
re-render.

Dark is a _blue_-black with a cyan accent rather than a neutral grey-black. Three
things make it work, and all three are load-bearing:

- **Panels carry a rim light**, not just a shadow (`.dark .panel-surface`). A drop
  shadow does nothing on a dark map — there is nothing lighter for it to fall on —
  so a 1px outer ring in the accent hue is what gives a panel an edge. Light was
  the default before precisely because dark read as murky without this.
- **`--c-accent-fg` exists** because white text on a cyan fill fails contrast, and
  every active segment, ON pill and primary button is filled with the accent. In
  dark it is near-black; in light it is white. Never hard-code `text-white` on an
  accent fill.
- **Area fills are dimmed on a dark basemap** (`DARK_FILL_SCALE` in `AreaLayers`).
  The AOI boxes nest four deep, and warm low-alpha fills that read as a pale tint
  over Voyager compound into an olive-brown wash over near-black, hiding the
  coastline. The strokes are unchanged — they read better against dark.

Section labels and captions all use the single `label-micro` utility (mono,
uppercase, letterspaced) rather than five hand-rolled variants, and any figure that
changes in place uses `numeric` for tabular digits so rows don't reflow as values
tick.

Components use tokens (`bg-panel`, `text-fg-muted`, `border-line`) and never raw
hex. The exceptions are deliberate and documented in place: threat-category and
layer hues are data (they must read identically in both themes) and are consumed
as _values_ — in marker inline styles, and in MapLibre paint expressions, neither
of which can reference a Tailwind class.

The active theme is Redux state (`store/slices/theme-slice.ts`). Reducers stay
pure — the DOM class swap and `localStorage` write happen in a listener
middleware (`store/theme-listener.ts`). `index.html` applies the stored class
before first paint so there is no flash of the wrong palette.

## Routing

The dashboard is one surface, so routing exists to make a single thing
shareable: which watch is open.

| Route             | Renders                                          |
| ----------------- | ------------------------------------------------ |
| `/`               | the map with its floating chrome                 |
| `/watch/:watchId` | the same map with that watch's detail panel open |
| anything else     | redirects to `/`                                 |

Because the panel is routed rather than held in component state, a deep link
opens straight into a topic and Back closes it.

## Data

Every read goes through [src/api/](src/api/): `client.ts` owns the base URL, the
timeout and the error shape; `monitoring.ts` exposes one function per endpoint.

Each endpoint returns live data once `VITE_API_BASE_URL` is set, and the bundled
fixture corpus otherwise — so the dashboard is fully demoable with no backend and
no component knows which is in play.

Failures from a _configured_ API are not swallowed: the map keeps its last good
data and the status pill turns amber (stale) or red (no feed), so a quiet map is
never confused with a broken one. It deliberately does **not** fall back to
fixtures on failure, which would look healthy while showing demo data.

Endpoints expected of the backend:

| Endpoint                             | Returns                                |
| ------------------------------------ | -------------------------------------- |
| `/monitoring/snapshot`               | `{ watches, clusters, details, feed }` |
| `/monitoring/feed`                   | `FeedItem[]`                           |
| `/monitoring/watches/:id`            | `WatchDetail \| null`                  |
| `/monitoring/layers/:layerId/points` | `MapPoint[]`                           |
| `/geocode?q=&limit=`                 | `GeoResult[]`                          |

Shapes are the exported types in [src/types/monitoring.ts](src/types/monitoring.ts).

### Adding demo data

Two files, and nothing else needs touching — new entries flow straight to the map.

**[src/data/seed.ts](src/data/seed.ts)** — a watch and everything hanging off it.
The four exports are joined by id, so all four need an entry for a topic to be
complete:

| Export          | Shape                          | Joined by                              |
| --------------- | ------------------------------ | -------------------------------------- |
| `SEED_WATCHES`  | `Watch[]`                      | `id` — the rail row                    |
| `SEED_CLUSTERS` | `Cluster[]`                    | `watchId` → a watch; `id` → feed items |
| `SEED_FEED`     | `FeedItem[]`                   | `clusterId` → a cluster                |
| `SEED_DETAILS`  | `Record<watchId, WatchDetail>` | key → a watch id                       |

A cluster needs `lat`/`lng` to appear on the map, and `size` sets its marker
diameter. Set `inferred: true` when the position came from a keyword or account
metadata rather than a geotag — the marker then draws dashed and the detail panel
flags it, which matters for anywhere the source posts carry no coordinates.

**[src/data/signals.ts](src/data/signals.ts)** — standalone points for the
SIGNALS layers (incidents, earthquakes, live news, maritime). One `MapPoint` per
feature; ages are declared as `agoMinutes` and resolved against load time so they
read as live.

Watches created in the browser are client-only until the backend owns creation,
so a poll or a snapshot reload preserves them rather than overwriting them.

## Environment

`VITE_*` values are inlined at build time — changing `.env` after a build has no
effect, you must rebuild. See [.env.example](.env.example).

| Var                                 | Purpose                                              |
| ----------------------------------- | ---------------------------------------------------- |
| `VITE_SENTRY_DASHBOARD_TITLE`       | Product name in the status pill                      |
| `VITE_MAP_TILE_URL_LIGHT` / `_DARK` | Switch Light/Dark from vector styles to raster tiles |
| `VITE_TERRAIN_URL`                  | Elevation tiles. Must be terrarium-encoded           |
| `VITE_MAP_TILE_ATTRIBUTION`         | Attribution shown on the map                         |
| `VITE_API_BASE_URL`                 | Monitoring API root. Empty ⇒ app starts empty        |
| `VITE_FEED_POLL_MS`                 | Activity-feed refresh interval (default `30000`)     |
| `VITE_GEOCODER_URL`                 | Place-name search. Empty ⇒ name search disabled      |
