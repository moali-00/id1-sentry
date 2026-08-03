import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import { setTheme, THEME_STORAGE_KEY, toggleTheme, type Theme } from '@/store/slices/themeSlice'
import type { RootState } from '@/store/store'

/**
 * Side effects of a theme change live here rather than in the reducer: swap the
 * class on `<html>` (which is what every `--c-*` token keys off) and persist the
 * choice for the next visit.
 */
export const themeListener = createListenerMiddleware()

export function applyThemeToDocument(theme: Theme): void {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(theme)
  root.style.colorScheme = theme
}

themeListener.startListening({
  matcher: isAnyOf(setTheme, toggleTheme),
  effect: (_action, api) => {
    const { theme } = (api.getState() as RootState).theme

    applyThemeToDocument(theme)

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Storage unavailable (private mode) — the theme still applies for this session.
    }
  },
})
