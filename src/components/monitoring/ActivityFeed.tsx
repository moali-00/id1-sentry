import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Layers, Loader2, PlugZap, RefreshCw } from 'lucide-react'
import { cn } from '@/utils/cn'
import { FeedRow } from '@/components/monitoring/FeedRow'
import { useMapController } from '@/components/monitoring/MapContext'
import { useManualRefresh } from '@/hooks/useLivePoll'
import { selectItrFeedItems } from '@/store/slices/itrSlice'
import { WATCHES_ENABLED } from '@/utils/layers'
import { useAppDispatch, useAppSelector } from '@/store/store'
import {
  hoverCluster,
  selectClusters,
  selectCluster,
  selectFeed,
  selectHoveredClusterId,
  selectRails,
  selectSelectedClusterId,
  selectStatus,
  selectVisibleFeed,
  selectWatches,
  toggleRail,
} from '@/store/slices/monitoringSlice'
import { IconButton } from '@/components/ui/IconButton'
import { Panel, PanelHeader, PanelTitle } from '@/components/ui/Panel'

/**
 * Floor on how long the refresh affordance spins. A cached or immediately
 * rejected request settles in a few ms; without this the icon would flicker
 * rather than read as a deliberate action.
 */
const MIN_SPIN_MS = 450

/** Right rail streaming matched items across every enabled watch. */
export function ActivityFeed() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { flyTo } = useMapController()
  const requestRefresh = useManualRefresh()

  const seedFeed = useAppSelector(selectFeed)
  const seedVisibleFeed = useAppSelector(selectVisibleFeed)
  const itrFeed = useAppSelector(selectItrFeedItems)

  // The demo watch corpus is hidden along with its markers while watches are
  // disabled, so the rail shows only what the target's own feeds returned.
  const feed = WATCHES_ENABLED ? seedFeed : []
  const watchFeed = WATCHES_ENABLED ? seedVisibleFeed : []
  const visibleFeed = [...itrFeed, ...watchFeed]
  const clusters = useAppSelector(selectClusters)
  const watches = useAppSelector(selectWatches)
  const status = useAppSelector(selectStatus)
  const hoveredClusterId = useAppSelector(selectHoveredClusterId)
  const selectedClusterId = useAppSelector(selectSelectedClusterId)
  const isOpen = useAppSelector(selectRails).activity

  const [refreshing, setRefreshing] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    await Promise.all([requestRefresh(), new Promise((resolve) => window.setTimeout(resolve, MIN_SPIN_MS))])
    if (mounted.current) setRefreshing(false)
  }

  const toggle = () => dispatch(toggleRail('activity'))

  // An empty feed has several quite different causes and the operator's next
  // move differs for each, so say which one it is rather than one generic line.
  const empty =
    status === 'error'
      ? { title: 'No source connected', hint: 'Nothing is reporting on this target right now.', icon: PlugZap }
      : status === 'loading'
        ? { title: 'Loading activity…', hint: 'Collecting the latest reporting.', icon: Loader2 }
        : WATCHES_ENABLED && watches.length === 0
          ? {
              title: 'No watches yet',
              hint: 'Create one in the LAYERS rail to start collecting activity.',
              icon: Layers,
            }
          : {
              title: 'Nothing on the wire',
              hint: 'The social and news feeds returned no items for this target.',
              icon: Layers,
            }

  const EmptyIcon = empty.icon

  if (!isOpen) {
    return (
      <Panel className="absolute top-4 right-4 w-[46px]">
        <button
          type="button"
          onClick={toggle}
          title="Show activity feed"
          aria-label="Show activity feed"
          className="flex w-full flex-col items-center gap-2 py-3 focus-visible:outline-none"
        >
          <ChevronLeft className="size-3.5 text-fg-muted" aria-hidden />
          {[0, 1, 2, 3, 4].map((index) => (
            <span key={index} aria-hidden className="h-[3px] w-6 rounded-full bg-fg-subtle" />
          ))}
        </button>
      </Panel>
    )
  }

  return (
    <Panel
      className="animate-rise absolute top-4 right-4 bottom-4 flex w-[272px] flex-col"
      style={{ animationDelay: '120ms' }}
    >
      <PanelHeader>
        <PanelTitle>ACTIVITY · LIVE FEED</PanelTitle>
        <IconButton title="Refresh feed" onClick={() => void refresh()}>
          <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} aria-hidden />
        </IconButton>
        <IconButton title="Collapse activity feed" onClick={toggle}>
          <ChevronRight className="size-3.5" aria-hidden />
        </IconButton>
      </PanelHeader>

      <div className="scroll-thin flex-1 overflow-y-auto">
        {visibleFeed.length > 0 ? (
          visibleFeed.map((item) => (
            <FeedRow
              key={item.id}
              item={item}
              active={hoveredClusterId === item.clusterId || selectedClusterId === item.clusterId}
              onHoverChange={(hovered) => dispatch(hoverCluster(hovered ? item.clusterId : null))}
              onSelect={() => {
                dispatch(selectCluster(item.clusterId))
                // A social row carries its own position; a watch row has to be
                // resolved through its cluster.
                if (item.focus) {
                  flyTo(item.focus.lat, item.focus.lng)
                  return
                }
                const cluster = clusters.find((candidate) => candidate.id === item.clusterId)
                if (!cluster) return
                flyTo(cluster.lat, cluster.lng)
                void navigate(`/watch/${cluster.watchId}`)
              }}
            />
          ))
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-8 text-center">
            <EmptyIcon className="size-5 text-fg-subtle" aria-hidden />
            <p className="text-xs font-semibold text-fg-muted">{empty.title}</p>
            <p className="text-[11px] text-fg-subtle">{empty.hint}</p>
          </div>
        )}
      </div>

      <div className="border-t border-line px-2.5 py-2">
        <p className="text-center text-[10px] text-fg-subtle">
          {visibleFeed.length} of {feed.length + itrFeed.length} shown · hover to locate, click to fly
        </p>
      </div>
    </Panel>
  )
}
