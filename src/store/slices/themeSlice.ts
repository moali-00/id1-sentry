import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type Theme = 'light' | 'dark'

/** Must match the pre-paint bootstrap script in `index.html`. */
export const THEME_STORAGE_KEY = 'sentry-theme'

/**
 * Dark by default, paired with the dark basemap.
 *
 * This reverses an earlier call. Light was the default because a dark surface over
 * a dark basemap read as murky — and it did, while the panels were a neutral
 * grey-black with a flat shadow and the basemap was a raster. What fixed it was
 * separating the panels from the canvas by a step on the design system's dark ramp
 * and giving each one a rim light in the accent hue (see `panel-surface` in
 * `index.css`), so a panel now has an edge of its own against the map instead of
 * dissolving into it.
 *
 * Light is unchanged and one click away in the status pill.
 */
const DEFAULT_THEME: Theme = 'dark'

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark'

/**
 * Read the persisted theme.
 *
 * Storage access is wrapped because Safari private mode throws on `localStorage`
 * rather than returning null.
 */
export function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (isTheme(stored)) return stored
  } catch {
    // Storage unavailable — fall through to the default.
  }
  return DEFAULT_THEME
}

interface ThemeState {
  theme: Theme
}

const initialState: ThemeState = {
  theme: readStoredTheme(),
}

/**
 * Theme state only. The DOM class and `localStorage` write are handled by a
 * listener in `store/themeListener.ts` so these reducers stay pure.
 */
const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload
    },
    toggleTheme(state) {
      state.theme = state.theme === 'light' ? 'dark' : 'light'
    },
  },
  selectors: {
    selectTheme: (state) => state.theme,
    selectIsLight: (state) => state.theme === 'light',
  },
})

export const { setTheme, toggleTheme } = themeSlice.actions
export const { selectTheme, selectIsLight } = themeSlice.selectors
export default themeSlice.reducer
