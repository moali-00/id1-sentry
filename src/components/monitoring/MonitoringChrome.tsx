import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEFAULT_PROJECTION, INITIAL_VIEW, TYPE_CATEGORY, type ViewPreset } from '@/utils/constants'
import { ActivityFeed } from '@/components/monitoring/ActivityFeed'
import { AssessmentStrip } from '@/components/monitoring/AssessmentStrip'
import { OutcomeBanner } from '@/components/outcome/OutcomeBanner'
import { SourceHealthPanel } from '@/components/monitoring/SourceHealthPanel'
import { CommandBar, type CommandPopover } from '@/components/monitoring/CommandBar'
import { CoordinateReadout } from '@/components/monitoring/CoordinateReadout'
import { LeftColumn } from '@/components/monitoring/LeftColumn'
import { ShortcutsOverlay } from '@/components/monitoring/ShortcutsOverlay'
import { StatusPill } from '@/components/monitoring/StatusPill'
import { WatchFormModal } from '@/components/monitoring/WatchFormModal'
import { ZoomControls } from '@/components/monitoring/ZoomControls'
import { createDraft, draftFromWatch } from '@/utils/watchDraft'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useOutsideClick } from '@/hooks/useOutsideClick'
import { useLivePoll } from '@/hooks/useLivePoll'
import { useFlightStream } from '@/hooks/useFlightStream'
import { useMapUrlState } from '@/hooks/useMapUrlState'
import type { SearchHit } from '@/components/monitoring/SearchBar'
import { useMapController } from '@/components/monitoring/MapContext'
import type { Watch, WatchDraft } from '@/types/monitoring'
import { useAppDispatch } from '@/store/store'
import { createWatch, editWatch, toggleRail } from '@/store/slices/monitoringSlice'
import { setProjection } from '@/store/slices/layersSlice'

/** Let the fly-to animation land before the detail panel covers the map. */
const OPEN_DETAIL_DELAY_MS = 750
const IMPORT_FLY_DURATION_S = 1.2

type FormTarget = { mode: 'create' } | { mode: 'edit'; watch: Watch }

/**
 * The floating UI layer over the map: status pill, both rails, the legend, zoom
 * controls and the watch form.
 *
 * The wrapper disables pointer events so map gestures pass through the gaps
 * between panels; each panel re-enables them for itself.
 */
export function MonitoringChrome() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { flyTo } = useMapController()

  useLivePoll()
  useFlightStream()
  useMapUrlState()

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)
  const [popover, setPopover] = useState<CommandPopover>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [searchFocusToken, setSearchFocusToken] = useState(0)
  const openDetailTimer = useRef<number | undefined>(undefined)

  // The collection-status panel hangs off the status pill with nothing to catch
  // a stray click, so it dismisses on one — the pill's own button included, or
  // its press would close and immediately reopen the panel.
  const sourcesRef = useRef<HTMLDivElement>(null)
  const healthRef = useRef<HTMLButtonElement>(null)
  useOutsideClick([sourcesRef, healthRef], () => setSourcesOpen(false), sourcesOpen)

  useEffect(() => () => window.clearTimeout(openDetailTimer.current), [])

  const handleSearchSelect = useCallback(
    (hit: SearchHit) => {
      flyTo(hit.lat, hit.lng, { zoom: hit.zoom })
      // A watch hit is an investigation, not just a place — open it.
      if (hit.watchId) void navigate(`/watch/${hit.watchId}`)
    },
    [flyTo, navigate],
  )

  // A region preset moves the camera and nothing else. It deliberately leaves the
  // projection, tilt and bearing exactly as the operator set them — going to a
  // region should not silently change how the map is drawn.
  const handlePresetSelect = useCallback(
    (preset: ViewPreset) => flyTo(preset.lat, preset.lng, { zoom: preset.zoom }),
    [flyTo],
  )

  useKeyboardShortcuts({
    toggleLayers: () => dispatch(toggleRail('watches')),
    toggleActivity: () => dispatch(toggleRail('activity')),
    focusSearch: () => setSearchFocusToken((token) => token + 1),
    togglePresets: () => setPopover((current) => (current === 'presets' ? null : 'presets')),
    toggleDisplay: () => setPopover((current) => (current === 'display' ? null : 'display')),
    toggleShare: () => setPopover((current) => (current === 'share' ? null : 'share')),
    // A full reset, camera included: the third dimension is part of "the view"
    // now, so leaving a 55° tilt in place would not be a reset.
    resetView: () => {
      dispatch(setProjection(DEFAULT_PROJECTION))
      flyTo(INITIAL_VIEW.center[0], INITIAL_VIEW.center[1], {
        zoom: INITIAL_VIEW.zoom,
        pitch: 0,
        bearing: 0,
      })
    },
    toggleFullscreen: () => {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void document.documentElement.requestFullscreen().catch(() => undefined)
    },
    toggleHelp: () => setHelpOpen((open) => !open),
    closeOverlays: () => {
      setPopover(null)
      setHelpOpen(false)
      setSourcesOpen(false)
    },
  })

  const handleSave = (draft: WatchDraft) => {
    if (formTarget?.mode === 'edit') {
      const { watch } = formTarget
      dispatch(
        editWatch({
          id: watch.id,
          name: draft.name.trim() || watch.name,
          category: TYPE_CATEGORY[draft.type],
        }),
      )
      setFormTarget(null)
      return
    }

    const { payload } = dispatch(createWatch(draft))
    setFormTarget(null)

    // A keyword import lands a cluster on the map — fly to it, then open its
    // detail once the camera has settled.
    if (!payload.cluster) return
    flyTo(payload.cluster.lat, payload.cluster.lng, { duration: IMPORT_FLY_DURATION_S })
    openDetailTimer.current = window.setTimeout(() => {
      void navigate(`/watch/${payload.watch.id}`)
    }, OPEN_DETAIL_DELAY_MS)
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[1000]">
      <StatusPill healthRef={healthRef} onHealthClick={() => setSourcesOpen((open) => !open)} />
      <LeftColumn
        onCreate={() => setFormTarget({ mode: 'create' })}
        onEdit={(watch) => setFormTarget({ mode: 'edit', watch })}
      />
      <ActivityFeed />
      <ZoomControls />

      <CommandBar
        popover={popover}
        onPopoverChange={setPopover}
        onSearchSelect={handleSearchSelect}
        onPresetSelect={handlePresetSelect}
        onOpenHelp={() => setHelpOpen(true)}
        focusToken={searchFocusToken}
      />

      {/* Bottom-centre: what happened, then what was expected — clear of both
          rails. The order is deliberate and it is the product's argument in two
          lines: the resolution sits above the assessment it settles, so an
          operator reading down the stack meets the outcome before the
          reasoning that anticipated it. */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        <OutcomeBanner />
        <AssessmentStrip />
      </div>

      {sourcesOpen && (
        <div ref={sourcesRef} className="pointer-events-auto absolute top-[126px] left-1/2 -translate-x-1/2">
          <SourceHealthPanel />
        </div>
      )}

      {/* The scale bar is MapLibre's own control, mounted inside `<MapCanvas />`
          and restyled in `index.css` — it has to live in the map's control
          container to be positioned by it. */}
      <CoordinateReadout />

      {helpOpen && <ShortcutsOverlay onClose={() => setHelpOpen(false)} />}

      {formTarget && (
        <WatchFormModal
          // Remount on target change so the draft always reflects the row clicked.
          key={formTarget.mode === 'edit' ? formTarget.watch.id : 'create'}
          mode={formTarget.mode}
          initialDraft={formTarget.mode === 'edit' ? draftFromWatch(formTarget.watch) : createDraft()}
          onSave={handleSave}
          onClose={() => setFormTarget(null)}
        />
      )}
    </div>
  )
}
