import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { INITIAL_VIEW, TYPE_CATEGORY, type ViewPreset } from '@/utils/constants'
import { ActivityFeed } from '@/components/monitoring/ActivityFeed'
import { AssessmentStrip } from '@/components/monitoring/AssessmentStrip'
import { SourceHealthPanel } from '@/components/monitoring/SourceHealthPanel'
import { CommandBar, type CommandPopover } from '@/components/monitoring/CommandBar'
import { CoordinateReadout } from '@/components/monitoring/CoordinateReadout'
import { LeftColumn } from '@/components/monitoring/LeftColumn'
import { ScaleBar } from '@/components/monitoring/ScaleBar'
import { ShortcutsOverlay } from '@/components/monitoring/ShortcutsOverlay'
import { StatusPill } from '@/components/monitoring/StatusPill'
import { WatchFormModal } from '@/components/monitoring/WatchFormModal'
import { ZoomControls } from '@/components/monitoring/ZoomControls'
import { createDraft, draftFromWatch } from '@/utils/watchDraft'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useLivePoll } from '@/hooks/useLivePoll'
import { useMapUrlState } from '@/hooks/useMapUrlState'
import type { SearchHit } from '@/components/monitoring/SearchBar'
import { useMapController } from '@/components/monitoring/MapContext'
import type { Watch, WatchDraft } from '@/types/monitoring'
import { useAppDispatch } from '@/store/store'
import { createWatch, editWatch, toggleRail } from '@/store/slices/monitoringSlice'

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
  useMapUrlState()

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)
  const [popover, setPopover] = useState<CommandPopover>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [searchFocusToken, setSearchFocusToken] = useState(0)
  const openDetailTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(openDetailTimer.current), [])

  const handleSearchSelect = useCallback(
    (hit: SearchHit) => {
      flyTo(hit.lat, hit.lng, { zoom: hit.zoom })
      // A watch hit is an investigation, not just a place — open it.
      if (hit.watchId) void navigate(`/watch/${hit.watchId}`)
    },
    [flyTo, navigate],
  )

  const handlePresetSelect = useCallback(
    (preset: ViewPreset) => flyTo(preset.lat, preset.lng, { zoom: preset.zoom }),
    [flyTo],
  )

  useKeyboardShortcuts({
    toggleLayers: () => dispatch(toggleRail('watches')),
    toggleActivity: () => dispatch(toggleRail('activity')),
    focusSearch: () => setSearchFocusToken((token) => token + 1),
    togglePresets: () => setPopover((current) => (current === 'presets' ? null : 'presets')),
    toggleShare: () => setPopover((current) => (current === 'share' ? null : 'share')),
    resetView: () => flyTo(INITIAL_VIEW.center[0], INITIAL_VIEW.center[1], { zoom: INITIAL_VIEW.zoom }),
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
      <StatusPill onHealthClick={() => setSourcesOpen((open) => !open)} />
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

      {/* Bottom-centre: the target's assessment, clear of both rails. */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        <AssessmentStrip />
      </div>

      {/* Clear of the command bar, which occupies the band just under the pill. */}
      {sourcesOpen && (
        <div className="pointer-events-auto absolute top-[100px] left-1/2 -translate-x-1/2">
          <SourceHealthPanel />
        </div>
      )}

      <CoordinateReadout />
      <ScaleBar />

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
