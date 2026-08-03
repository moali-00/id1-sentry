import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import App from '@/App'
import { store } from '@/store/store'
import { applyThemeToDocument } from '@/store/themeListener'
import '@/index.css'

// `index.html` sets the theme class before first paint to avoid a flash. Re-apply
// from the store so the two can never disagree (e.g. if storage was unreadable
// during the inline bootstrap).
applyThemeToDocument(store.getState().theme.theme)

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
