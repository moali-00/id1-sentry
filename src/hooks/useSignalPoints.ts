import { useEffect, useRef } from 'react'
import { SIGNAL_LAYER_IDS } from '@/utils/layers'
import { loadLayerPoints, selectLayerEnabled } from '@/store/slices/layersSlice'
import { useAppDispatch, useAppSelector } from '@/store/store'

/**
 * Fetch a signal layer's points the first time it is switched on.
 *
 * Lazy rather than eager: most sessions use two or three layers, and fetching
 * all of them up front would cost several requests nobody asked for. Fetched
 * ids are remembered so a layer that legitimately returns nothing is not
 * re-requested on every toggle.
 */
export function useSignalPoints(): void {
  const dispatch = useAppDispatch()
  const enabled = useAppSelector(selectLayerEnabled)
  const requested = useRef(new Set<string>())

  useEffect(() => {
    for (const layerId of SIGNAL_LAYER_IDS) {
      if (!enabled[layerId] || requested.current.has(layerId)) continue
      requested.current.add(layerId)
      void dispatch(loadLayerPoints(layerId))
    }
  }, [dispatch, enabled])
}
