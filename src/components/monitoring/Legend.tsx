import { CATEGORIES, CATEGORY_KEYS } from '@/utils/constants'
import { DATA_LAYERS, WATCHES_ENABLED } from '@/utils/layers'
import { CategorySwatch } from '@/components/ui/Badges'
import { Panel } from '@/components/ui/Panel'
import { useAppSelector } from '@/store/store'
import { selectLayerEnabled } from '@/store/slices/layersSlice'

/**
 * Key for whatever is currently drawn.
 *
 * Threat categories only appear while watches are enabled — they describe watch
 * markers, and with watches off they would be a legend for nothing. The layer
 * block is the live one: it lists exactly the layers switched on, so the panel
 * shrinks and grows with the map instead of asserting a fixed vocabulary.
 */
export function Legend() {
  const layerEnabled = useAppSelector(selectLayerEnabled)
  const activeLayers = DATA_LAYERS.filter((layer) => layerEnabled[layer.id])

  // Nothing to key — say nothing rather than showing an empty titled box.
  if (!WATCHES_ENABLED && activeLayers.length === 0) return null

  return (
    <Panel className="animate-rise w-48 flex-none px-3 py-2.5" style={{ animationDelay: '160ms' }}>
      {WATCHES_ENABLED && (
        <div className="mb-2.5 flex flex-col gap-1.5">
          <h2 className="label-micro text-fg-muted">THREAT CATEGORIES</h2>
          {CATEGORY_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-2 text-xs text-fg">
              <CategorySwatch category={key} className="size-[11px]" />
              {CATEGORIES[key].label}
            </div>
          ))}
        </div>
      )}

      {activeLayers.length > 0 && (
        <div
          className={
            WATCHES_ENABLED ? 'flex flex-col gap-1.5 border-t border-line-soft pt-2.5' : 'flex flex-col gap-1.5'
          }
        >
          <h2 className="label-micro text-fg-muted">ACTIVE LAYERS</h2>
          {activeLayers.map((layer) => (
            <div key={layer.id} className="flex items-center gap-2 text-xs text-fg">
              <span aria-hidden style={{ background: layer.color }} className="size-[11px] flex-none rounded-full" />
              {layer.label}
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
