# Sentry Dashboard

Standalone geospatial live-monitoring surface for OSINT watches. A full-bleed
Leaflet map is the product; the layer rail, the activity feed, the command bar,
the legend and the topic detail panel float over it as chrome.

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

## Stack

React 19, Vite 7, Tailwind CSS v4, React Router 7, Redux Toolkit, Leaflet.
Managed by **pnpm**.

## Layout

Deliberately the same layer-based layout as `apps/frontend`, so moving between
the two apps costs nothing.

```
src/
  App.tsx       composition root — error boundary, store provider, router
  main.tsx      entry point
  api/          client + endpoint modules (the only place that knows about HTTP)
  components/
    monitoring/ the dashboard's components + the Leaflet map provider/context
    ui/         presentational primitives (Panel, Chip, IconButton, …)
    ErrorBoundary.tsx
  data/         seed corpus, the keyword-import dataset, signal-layer fixtures
  hooks/        map hooks (useLeafletMap, useClusterMarkers, usePointLayer,
                useDayNightLayer, useGraticuleLayer, useMapUrlState) and
                session hooks (useLivePoll, useSignalPoints,
                useKeyboardShortcuts, useWatchDraft, useEscapeKey)
  layouts/      main_layout — the full-bleed map shell with an <Outlet />
  pages/        routed views — watch_detail, route_error
  routes/       router definition
  store/        store + typed hooks, slices/, themeListener
  types/        shared domain model
  utils/        pure helpers — constants, layers, env, cn, colour, format,
                markerIcon, buildWatch, watchDraft
```

## Layers

The left rail lists everything drawn on the map, in three collapsible groups
declared in [src/utils/layers.ts](src/utils/layers.ts):

| Group      | Contents                                                            |
| ---------- | ------------------------------------------------------------------- |
| `watches`  | the operator's own standing queries — created, edited, toggled here  |
| `signals`  | global incidents, earthquakes, live news, maritime — plotted points  |
| `display`  | day/night terminator and graticule — cartographic overlays, no data  |

Watches live in `monitoringSlice` because they are domain objects with their own
lifecycle; the rest are catalogue data in `layersSlice`. Signal layers fetch
lazily, the first time each is switched on.

## Keyboard and deep links

`?` lists every shortcut; the sheet is generated from the same table the handler
uses, so the two cannot drift.

The query string mirrors the camera and the layer selection
(`?lat=&lon=&zoom=&layers=`) alongside the existing `/watch/:watchId` path, so a
copied link reopens the whole picture — view, layers and open topic. The Share
button copies it.

## Getting to a location

Four routes to the same place, in the order the search bar tries them:

| Input                                | Resolved by                                       |
| ------------------------------------ | ------------------------------------------------- |
| `24.86, 67.00` (decimal degrees)     | locally, no network                                |
| a watch name                         | locally, from the store                            |
| `Karachi`, `Bosphorus`, `Suez Canal` | [src/api/geocode.ts](src/api/geocode.ts)           |
| the compass button, or `P`           | `VIEW_PRESETS` in [constants.ts](src/utils/constants.ts) |

Place-name search prefers the API's `/geocode` once `VITE_API_BASE_URL` is set,
and falls back to a Nominatim-compatible endpoint (`VITE_GEOCODER_URL`,
defaulting to OpenStreetMap's public instance) so it works before the backend
lands. Zoom is derived from each result's bounding box, so a country lands at
z4 and a landmark at z12 rather than everything sharing one zoom.

Deep links (`?lat=&lon=&zoom=`) work regardless of any of the above.

## Basemaps

Four keyless rasters, picked from the DISPLAY group in the layer rail and held
in `layersSlice`:

| Basemap       | Source            | Use                                          |
| ------------- | ----------------- | -------------------------------------------- |
| Voyager       | CARTO             | **default** — keeps roads, borders and labels legible at world zoom |
| Light         | CARTO Positron    | minimal, for dense marker sets                |
| Dark          | CARTO Dark Matter | low-light rooms                               |
| Satellite     | Esri World Imagery| terrain and infrastructure context            |

The basemap is **independent of the chrome theme** — a dark UI over a legible
map is a normal thing to want, and tying the two together made the whole surface
dark by default. Marker contrast follows the *basemap*, since that is what the
markers are drawn on.

`VITE_MAP_TILE_URL_LIGHT` / `_DARK` override the Light and Dark entries for
air-gapped deployments.

### Sharpness and zoom feel

Three settings do most of the work here, and all three are easy to lose:

- **Retina tiles.** The CARTO URLs carry a `{r}` placeholder that resolves to
  `@2x` on a HiDPI screen ([useLeafletMap.ts](src/hooks/useLeafletMap.ts)). It is
  substituted by hand rather than with Leaflet's `detectRetina`, which *also*
  halves the tile size and shifts the zoom offset — with an `@2x` URL that
  double-counts and requests the wrong tiles.
- **Fractional zoom.** `zoomSnap: 0.25` makes the wheel feel continuous instead
  of jumping a whole level per notch. `0` would be smoother still, but raster
  tiles then sit permanently scaled between levels and go soft.
- **`MAX_ZOOM` is 18.** A cap of 12 stops the map at roughly city scale and
  makes it feel like it will not let you in.

Raster tiles set the ceiling on all of this — labels are pixels baked at one
scale, so they soften between zoom levels no matter what. Vector tiles would fix
it, but they need a different map engine (this was tried with MapLibre GL and
reverted: see the note below).

> **On MapLibre.** A migration to MapLibre GL was attempted for the 3D globe and
> vector basemaps, and rolled back. The blocker worth recording: Tailwind v4
> emits its utilities inside `@layer utilities`, and an unlayered rule beats a
> layered one whatever the source order — so MapLibre's own
> `.maplibregl-map { position: relative }` silently overrode `absolute inset-0`
> on the map container, collapsing it to zero height and rendering a blank map
> with no error. Leaflet does not have this problem because it sets the
> container's position from JS, and only when the computed value is `static`.

## Language

The dashboard is **English-only**. There is no language filter, no
original/translation split on a post, and no bidirectional text handling — a
post has one `text` field. Geocoder results are requested with
`accept-language=en` so place names read consistently with the rest of the UI.

## Theming

Both light and dark palettes ship, light by default. Every colour is declared once in
[src/index.css](src/index.css) as a `--c-*` pair (light on `:root`, dark on
`.dark`) and exposed to Tailwind through `@theme inline`, so a class like
`bg-panel` follows the theme with no JS and no re-render.

Components use tokens (`bg-panel`, `text-fg-muted`, `border-line`) and never raw
hex. The exceptions are deliberate and documented in place: threat-category hues
are data (they must read identically in both themes) and Leaflet's `divIcon`
takes an HTML string that Tailwind's scanner cannot see.

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

Failures from a *configured* API are not swallowed: the map keeps its last good
data and the status pill turns amber (stale) or red (no feed), so a quiet map is
never confused with a broken one. It deliberately does **not** fall back to
fixtures on failure, which would look healthy while showing demo data.

Endpoints expected of the backend:

| Endpoint                              | Returns                                  |
| ------------------------------------- | ---------------------------------------- |
| `/monitoring/snapshot`                | `{ watches, clusters, details, feed }`   |
| `/monitoring/feed`                    | `FeedItem[]`                             |
| `/monitoring/watches/:id`             | `WatchDetail \| null`                    |
| `/monitoring/layers/:layerId/points`  | `MapPoint[]`                             |
| `/geocode?q=&limit=`                  | `GeoResult[]`                            |

Shapes are the exported types in [src/types/monitoring.ts](src/types/monitoring.ts).

### Adding demo data

Two files, and nothing else needs touching — new entries flow straight to the map.

**[src/data/seed.ts](src/data/seed.ts)** — a watch and everything hanging off it.
The four exports are joined by id, so all four need an entry for a topic to be
complete:

| Export          | Shape                          | Joined by                             |
| --------------- | ------------------------------ | ------------------------------------- |
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

| Var                                 | Purpose                                          |
| ----------------------------------- | ------------------------------------------------ |
| `VITE_SENTRY_DASHBOARD_TITLE`       | Product name in the status pill                  |
| `VITE_MAP_TILE_URL_LIGHT` / `_DARK` | Basemap overrides for air-gapped deployments     |
| `VITE_MAP_TILE_ATTRIBUTION`         | Attribution shown on the map                     |
| `VITE_API_BASE_URL`                 | Monitoring API root. Empty ⇒ app starts empty    |
| `VITE_FEED_POLL_MS`                 | Activity-feed refresh interval (default `30000`) |
| `VITE_GEOCODER_URL`                 | Place-name search. Empty ⇒ name search disabled  |
