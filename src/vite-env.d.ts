/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DASHBOARD_TITLE?: string
  readonly VITE_MAP_TILE_URL_LIGHT?: string
  readonly VITE_MAP_TILE_URL_DARK?: string
  readonly VITE_MAP_TILE_ATTRIBUTION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
