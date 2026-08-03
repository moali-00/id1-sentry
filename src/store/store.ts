import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector, useStore } from 'react-redux'
import itrReducer from '@/store/slices/itrSlice'
import layersReducer from '@/store/slices/layersSlice'
import monitoringReducer from '@/store/slices/monitoringSlice'
import themeReducer from '@/store/slices/themeSlice'
import { themeListener } from '@/store/themeListener'

export const store = configureStore({
  reducer: {
    theme: themeReducer,
    monitoring: monitoringReducer,
    layers: layersReducer,
    itr: itrReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(themeListener.middleware),
  devTools: import.meta.env.DEV,
})

export type AppStore = typeof store
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

/**
 * Typed Redux hooks. Always use these rather than the raw `react-redux`
 * exports so state and dispatch stay inferred across the app.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
export const useAppStore = useStore.withTypes<AppStore>()
