import { CATEGORIES, CATEGORY_KEYS } from '@/utils/constants'
import { DATA_LAYERS, WATCHES_ENABLED } from '@/utils/layers'
import { CategorySwatch } from '@/components/ui/Badges'
import { Panel } from '@/components/ui/Panel'
import { useAppSelector } from '@/store/store'
import { selectLayerEnabled } from '@/store/slices/layersSlice'
import { ALTITUDE_BANDS, BAND_COLOR } from '@/utils/flights'

/** Hover text per band. The ramp itself is labelled only at its two ends. */
const BAND_LABEL: Record<(typeof ALTITUDE_BANDS)[number], string> = {
  ground: 'On ground',
  low: 'Below FL100',
  mid: 'FL100–250',
  high: 'FL250–350',
  upper: 'Above FL350',
}

/**
 * Key for whatever is currently drawn.
 *
 * Threat categories only appear while watches are enabled — they describe watch
 * markers, and with watches off they would be a legend for nothing. The layer
 * block is the live one: it lists exactly the layers switched on, so the panel
 * shrinks and grows with the map instead of asserting a fixed vocabulary.
 *
 * **This panel is bounded and scrolls.** It shares a fixed-height column with the
 * layer rail, and it grows with the number of active layers — so left to its
 * natural height it squeezed the rail to a single row and still overflowed the
 * bottom of the screen. It now caps at a fraction of the column (see
 * `LeftColumn`) and scrolls inside that, because the rail is the interactive
 * surface and must keep its space.
 */
export function Legend() {
  const layerEnabled = useAppSelector(selectLayerEnabled)
  const activeLayers = DATA_LAYERS.filter((layer) => layerEnabled[layer.id])
  const aircraftOn = layerEnabled.itr_aircraft

  // Nothing to key — say nothing rather than showing an empty titled box.
  if (!WATCHES_ENABLED && activeLayers.length === 0) return null

  return (
    <Panel
      className="scroll-thin animate-rise flex min-h-0 w-48 flex-col overflow-y-auto px-3 py-2.5"
      style={{ animationDelay: '160ms' }}
    >
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

      {/*
        The altitude key as a single ramp rather than five labelled rows.
        Five rows cost six lines in a panel that has to share a fixed-height
        column with the rail — and a ramp is the better picture anyway, because
        altitude is continuous and the bands are buckets over it. The two ends are
        labelled; each segment carries its exact band as hover text.
      */}
      {aircraftOn && (
        <div className="mt-2.5 border-t border-line-soft pt-2.5">
          <h2 className="label-micro text-fg-muted">AIRCRAFT ALTITUDE</h2>
          <div className="mt-1.5 flex overflow-hidden rounded-[3px]">
            {ALTITUDE_BANDS.map((band) => (
              <span
                key={band}
                title={BAND_LABEL[band]}
                style={{ background: BAND_COLOR[band] }}
                className="h-2 flex-1"
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between numeric text-[9px] text-fg-subtle">
            <span>GND</span>
            <span>FL350+</span>
          </div>
        </div>
      )}
    </Panel>
  )
}
