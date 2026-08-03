import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type Theme = 'light' | 'dark'

/** Must match the pre-paint bootstrap script in `index.html`. */
export const THEME_STORAGE_KEY = 'sentry-theme'

/**
 * Light by default. The dashboard's job is legibility, and a dark surface over
 * a dark basemap was reading as murky rather than as a command centre. Dark is
 * one click away in the status pill for operators who want it.
 */
const DEFAULT_THEME: Theme = 'light'

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
