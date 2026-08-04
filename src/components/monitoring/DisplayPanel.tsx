import { useMemo } from 'react'
import { Globe2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { LayerRow } from '@/components/monitoring/LayerRow'
import { useMapController } from '@/components/monitoring/MapContext'
import { layersInGroup } from '@/utils/layers'
import {
  BASEMAPS,
  BASEMAP_IDS,
  GLOBE_PITCH,
  INITIAL_VIEW,
  PROJECTIONS,
  type BasemapId,
  type ProjectionId,
} from '@/utils/constants'
import {
  selectBasemap,
  selectLayerEnabled,
  selectProjection,
  setBasemap,
  setProjection,
  toggleLayer,
} from '@/store/slices/layersSlice'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { Panel, PanelHeader, PanelTitle } from '@/components/ui/Panel'

/**
 * Everything about **how the map is drawn**, in one popover off the command bar.
 *
 * These used to sit at the bottom of the layer rail, and that was the wrong place
 * twice over. The rail answers "what is drawn on this map" — it is a list of data
 * layers — whereas projection, basemap and scope answer "how". Mixing the two is
 * also why they ended up below the fold behind eleven feed rows, which is no place
 * for the flat/globe switch.
 *
 * Here they sit beside JUMP TO and SHARE, which are the map's other
 * act-on-the-whole-view controls, in the one part of the chrome an operator
 * already reaches for.
 *
 * The three display *layers* come last and are still `LayerRow`s, because they are
 * genuine on/off layers with a colour and a hint — the same component the rail
 * uses, so they behave identically wherever they are rendered.
 */
export function DisplayPanel() {
  const dispatch = useAppDispatch()
  const { flyTo } = useMapController()
  const activeBasemap = useAppSelector(selectBasemap)
  const activeProjection = useAppSelector(selectProjection)
  const layerEnabled = useAppSelector(selectLayerEnabled)

  const basemapSegments = useMemo(() => BASEMAP_IDS.map((id) => ({ id, label: BASEMAPS[id].label })), [])
  const overlays = useMemo(() => layersInGroup('display'), [])

  return (
    <Panel className="w-[268px]">
      <PanelHeader>
        <PanelTitle>DISPLAY</PanelTitle>
      </PanelHeader>

      <div className="flex flex-col gap-1 p-2.5">
        <SegmentedControl<ProjectionId>
          label="PROJECTION"
          segments={PROJECTIONS.map(({ id, label, hint }) => ({ id, label, hint }))}
          active={activeProjection}
          onSelect={(id) => dispatch(setProjection(id))}
        />

        <SegmentedControl<BasemapId>
          label="BASEMAP"
          segments={basemapSegments}
          active={activeBasemap}
          onSelect={(id) => dispatch(setBasemap(id))}
        />

        <div className="mb-1 px-1">
          {/*
            "World", not "Global" — this moves the *camera* out until the whole
            planet is in frame, and the projection control right above it has an
            option called "Globe". Two controls a letter apart read as duplicates
            of each other however correct each name is on its own.
          */}
          <p className="label-micro mb-1.5 text-fg-subtle">SCOPE</p>
          <button
            type="button"
            onClick={() =>
              flyTo(INITIAL_VIEW.center[0], INITIAL_VIEW.center[1], {
                zoom: INITIAL_VIEW.zoom,
                // North-up, and levelled to whatever the current projection rests
                // at. A whole-world view seen at a 60° tilt is mostly horizon.
                pitch: activeProjection === 'globe' ? GLOBE_PITCH : 0,
                bearing: 0,
              })
            }
            title="Pull the camera back until the whole world is in frame"
            className={cn(
              'flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-control px-2 py-1.5',
              'text-[11px] font-semibold text-fg-muted transition-colors hover:border-accent hover:text-fg',
              'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
            )}
          >
            <Globe2 className="size-3.5" aria-hidden />
            World
          </button>
        </div>

        <div className="border-t border-line-soft pt-2">
          <p className="label-micro mb-1 px-1 text-fg-subtle">OVERLAYS</p>
          {overlays.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              enabled={layerEnabled[layer.id]}
              onToggle={() => dispatch(toggleLayer(layer.id))}
            />
          ))}
        </div>
      </div>
    </Panel>
  )
}
