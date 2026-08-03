import { ChevronLeft, ChevronRight, Layers, Plus } from 'lucide-react'
import { categoryColor } from '@/utils/constants'
import { LAYER_GROUPS, WATCHES_ENABLED, layersInGroup } from '@/utils/layers'
import { BasemapPicker } from '@/components/monitoring/BasemapPicker'
import { LayerGroupSection } from '@/components/monitoring/LayerGroupSection'
import { LayerRow } from '@/components/monitoring/LayerRow'
import { TargetWatchRow } from '@/components/monitoring/TargetWatchRow'
import { WatchRow } from '@/components/monitoring/WatchRow'
import type { LayerGroupKey, SignalLayerId, Watch } from '@/types/monitoring'
import { useAppDispatch, useAppSelector } from '@/store/store'
import {
  selectEnabled,
  selectRails,
  selectWatches,
  setAllWatchesEnabled,
  toggleRail,
  toggleWatch,
} from '@/store/slices/monitoringSlice'
import {
  selectExpandedGroups,
  selectLayerEnabled,
  selectLayerLoading,
  selectLayerPoints,
  setGroupEnabled,
  toggleGroupExpanded,
  toggleLayer,
} from '@/store/slices/layersSlice'
import { IconButton } from '@/components/ui/IconButton'
import { Panel, PanelHeader, PanelTitle } from '@/components/ui/Panel'

interface LayerRailProps {
  onCreate: () => void
  onEdit: (watch: Watch) => void
}

/**
 * Left rail: every map layer, grouped and collapsible.
 *
 * The operator's watches are the first group and behave exactly as they always
 * have; `signals` and `display` add catalogue layers from `utils/layers.ts`.
 * Grouping them in one rail — rather than adding a second panel — keeps a single
 * answer to "what is currently drawn on this map".
 */
export function LayerRail({ onCreate, onEdit }: LayerRailProps) {
  const dispatch = useAppDispatch()

  const watches = useAppSelector(selectWatches)
  const watchEnabled = useAppSelector(selectEnabled)
  const layerEnabled = useAppSelector(selectLayerEnabled)
  const expanded = useAppSelector(selectExpandedGroups)
  const points = useAppSelector(selectLayerPoints)
  const loading = useAppSelector(selectLayerLoading)
  const isOpen = useAppSelector(selectRails).watches

  const toggleOpen = () => dispatch(toggleRail('watches'))

  const activeWatchCount = watches.filter((watch) => watchEnabled[watch.id] ?? true).length

  // The ITR target counts as one watch and is "on" whenever any of its feeds
  // are, so the group header reads the same way for it as for a real watch.
  const targetOn = layersInGroup('itr_feeds').some((layer) => layerEnabled[layer.id])

  const groupCounts = (groupKey: LayerGroupKey) => {
    if (groupKey === 'watches') {
      const total = 1 + (WATCHES_ENABLED ? watches.length : 0)
      return { active: (targetOn ? 1 : 0) + (WATCHES_ENABLED ? activeWatchCount : 0), total }
    }
    const layers = layersInGroup(groupKey)
    return { active: layers.filter((layer) => layerEnabled[layer.id]).length, total: layers.length }
  }

  const toggleAll = (groupKey: LayerGroupKey) => {
    const { active } = groupCounts(groupKey)
    // Any layer on means the group toggle clears them; only a fully-off group
    // turns everything on.
    const next = active === 0

    if (groupKey === 'watches') {
      dispatch(setGroupEnabled({ groupKey: 'itr_feeds', enabled: next }))
      if (WATCHES_ENABLED) dispatch(setAllWatchesEnabled(next))
      return
    }

    dispatch(setGroupEnabled({ groupKey, enabled: next }))
  }

  if (!isOpen) {
    const activeSwatches = [
      ...watches.filter((watch) => watchEnabled[watch.id] ?? true).map((watch) => categoryColor(watch.category)),
      ...LAYER_GROUPS.filter((group) => group.key !== 'watches')
        .flatMap((group) => layersInGroup(group.key))
        .filter((layer) => layerEnabled[layer.id])
        .map((layer) => layer.color),
    ]

    return (
      <Panel className="scroll-thin w-[46px] flex-none overflow-y-auto">
        <button
          type="button"
          onClick={toggleOpen}
          title="Show layers"
          aria-label="Show layers"
          className="flex w-full flex-col items-center gap-2.5 py-3 focus-visible:outline-none"
        >
          <Layers className="size-4 text-fg-muted" aria-hidden />
          {activeSwatches.map((color, index) => (
            <span
              key={`${color}-${index}`}
              aria-hidden
              style={{ background: color }}
              className="size-4 rounded-[3px]"
            />
          ))}
          <ChevronRight className="size-3.5 text-fg-muted" aria-hidden />
        </button>
      </Panel>
    )
  }

  return (
    // `min-h-0` lets the panel shrink below its content height so the legend
    // below always keeps its space; the body then scrolls instead.
    <Panel className="animate-rise flex min-h-0 w-[240px] flex-col" style={{ animationDelay: '80ms' }}>
      <PanelHeader className="flex-none">
        <PanelTitle>LAYERS</PanelTitle>
        <IconButton title="Collapse layers" onClick={toggleOpen}>
          <ChevronLeft className="size-3.5" aria-hidden />
        </IconButton>
      </PanelHeader>

      <div className="scroll-thin flex min-h-0 flex-col overflow-y-auto">
        {LAYER_GROUPS.map((group) => {
          const { active, total } = groupCounts(group.key)

          return (
            <LayerGroupSection
              key={group.key}
              label={group.label}
              activeCount={active}
              totalCount={total}
              expanded={expanded[group.key]}
              onToggleExpanded={() => dispatch(toggleGroupExpanded(group.key))}
              onToggleAll={() => toggleAll(group.key)}
            >
              {group.key === 'watches' ? (
                <>
                  <TargetWatchRow />

                  {WATCHES_ENABLED &&
                    watches.map((watch) => (
                      <WatchRow
                        key={watch.id}
                        watch={watch}
                        enabled={watchEnabled[watch.id] ?? true}
                        onToggle={() => dispatch(toggleWatch(watch.id))}
                        onEdit={() => onEdit(watch)}
                      />
                    ))}

                  {WATCHES_ENABLED && (
                    <button
                      type="button"
                      onClick={onCreate}
                      className="mx-1 mt-1.5 flex items-center justify-center gap-1.5 rounded-md border-[1.5px] border-dashed border-line py-2 text-xs font-semibold text-fg transition-colors hover:border-solid hover:border-accent hover:bg-accent hover:text-white focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                    >
                      <Plus className="size-3.5" aria-hidden /> New watch
                    </button>
                  )}
                </>
              ) : (
                <>
                  {group.key === 'display' && <BasemapPicker />}
                  {layersInGroup(group.key).map((layer) => {
                    // Only `signals` layers carry points; the registry guarantees
                    // their ids are `SignalLayerId`s, which the group key narrows.
                    const signalId = layer.groupKey === 'signals' ? (layer.id as SignalLayerId) : null

                    return (
                      <LayerRow
                        key={layer.id}
                        layer={layer}
                        enabled={layerEnabled[layer.id]}
                        count={signalId ? points[signalId].length : undefined}
                        loading={signalId ? loading[signalId] : false}
                        onToggle={() => dispatch(toggleLayer(layer.id))}
                      />
                    )
                  })}
                </>
              )}
            </LayerGroupSection>
          )
        })}
      </div>
    </Panel>
  )
}
