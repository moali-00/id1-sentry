import { ChevronLeft, ChevronRight, Layers, Plus } from 'lucide-react'
import { categoryColor } from '@/utils/constants'
import { LAYER_GROUPS, WATCHES_ENABLED, layersInGroup } from '@/utils/layers'
import { CameraLayerRow } from '@/components/monitoring/CameraLayerRow'
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
 * How many swatches the collapsed rail shows before it summarises the rest.
 *
 * Twelve fits a 900px-tall window without scrolling the gutter, which is the
 * point of the collapsed state.
 */
const COLLAPSED_SWATCH_LIMIT = 12

/**
 * Left rail: every map layer, grouped and collapsible.
 *
 * The operator's watches are the first group; the rest are catalogue layers from
 * `utils/layers.ts`. One rail rather than several panels keeps a single answer to
 * "what is currently drawn on this map".
 *
 * The `display` group is deliberately absent — projection, basemap and the
 * cartographic overlays answer *how* the map is drawn, not what is on it, and they
 * live in `DisplayPanel` off the command bar.
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

    // The collapsed rail is a glance, not an inventory: it answers "roughly what
    // is on the map" in a 46px gutter. With watches enabled the honest count runs
    // to the high twenties, which turns the gutter into a scrolling ribbon taller
    // than the window and stops reading as a summary at all. Capped, with the
    // remainder stated rather than silently dropped — the same "+N" the platform
    // chips use in `WatchFormModal`.
    const visible = activeSwatches.slice(0, COLLAPSED_SWATCH_LIMIT)
    const overflow = activeSwatches.length - visible.length

    return (
      <Panel className="scroll-thin w-[46px] flex-none overflow-y-auto">
        <button
          type="button"
          onClick={toggleOpen}
          title={`Show layers — ${activeSwatches.length} active`}
          aria-label={`Show layers — ${activeSwatches.length} active`}
          className="flex w-full flex-col items-center gap-2.5 py-3 focus-visible:outline-none"
        >
          <Layers className="size-4 text-fg-muted" aria-hidden />
          {visible.map((color, index) => (
            <span
              key={`${color}-${index}`}
              aria-hidden
              style={{ background: color }}
              className="size-4 rounded-[3px]"
            />
          ))}
          {overflow > 0 && (
            <span aria-hidden className="label-micro text-fg-subtle">
              +{overflow}
            </span>
          )}
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
                      className="mx-1 mt-1.5 flex items-center justify-center gap-1.5 rounded-md border-[1.5px] border-dashed border-line py-2 text-xs font-semibold text-fg transition-colors hover:border-solid hover:border-accent hover:bg-accent hover:text-accent-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                    >
                      <Plus className="size-3.5" aria-hidden /> New watch
                    </button>
                  )}
                </>
              ) : group.key === 'cameras' ? (
                // Its own row component: the camera layer has states between "drawn"
                // and "not drawn" — zoomed too far out, nothing in this area, an
                // upstream down — and each looks like a bug unless it is said out loud.
                <CameraLayerRow />
              ) : (
                <>
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
