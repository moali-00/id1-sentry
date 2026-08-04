import { useCallback, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Ban, Check, Flag, MapPin, PenLine, Sparkles, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { confidenceLabel } from '@/utils/format'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { CATEGORIES } from '@/utils/constants'
import { PostCard } from '@/components/monitoring/PostCard'
import type { WatchDetail } from '@/types/monitoring'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { selectCluster, selectDetailByWatchId, selectWatchById } from '@/store/slices/monitoringSlice'
import { CategorySwatch, SuggestedTag } from '@/components/ui/Badges'
import { ConfidenceMeter } from '@/components/ui/ConfidenceMeter'
import { FieldLabel } from '@/components/ui/FieldLabel'
import { IconButton } from '@/components/ui/IconButton'

/**
 * How a cluster's position was established. Kept as three static class strings
 * rather than a computed hue so Tailwind can see them at build time.
 */
const LOCATION_VARIANTS = {
  missing: {
    label: 'NO LOCATION · keyword',
    className: 'text-status-missing bg-status-missing/10 border-status-missing/30',
  },
  observed: {
    label: 'OBSERVED · geotagged',
    className: 'text-status-observed bg-status-observed/10 border-status-observed/30',
  },
  inferred: {
    label: 'INFERRED · low-conf',
    className: 'text-status-inferred bg-status-inferred/10 border-status-inferred/30',
  },
} as const

function locationVariant(detail: WatchDetail) {
  if (detail.locationNote) return LOCATION_VARIANTS.missing
  return detail.observed ? LOCATION_VARIANTS.observed : LOCATION_VARIANTS.inferred
}

function ActionButton({ icon, label, danger = false }: { icon: ReactNode; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-1.5 rounded-md border bg-control px-3 py-2 text-xs font-semibold transition-colors',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        danger ? 'border-status-missing/30 text-status-missing' : 'border-line text-fg',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

/**
 * Topic detail for one watch, opened as a nested route (`/watch/:watchId`).
 *
 * Routing it — rather than holding it in component state — makes an open
 * investigation shareable and gives Back the behaviour analysts expect.
 */
export default function WatchDetailPage() {
  const { watchId } = useParams<{ watchId: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const watch = useAppSelector((state) => selectWatchById(state, watchId))
  const detail = useAppSelector((state) => selectDetailByWatchId(state, watchId))

  const close = useCallback(() => {
    dispatch(selectCluster(null))
    void navigate('/')
  }, [dispatch, navigate])

  useEscapeKey(close)

  // A watch can exist without detail (a typed watch that has not matched yet),
  // and a stale link can name a watch that is gone. Neither should render blank.
  if (!watch || !detail) return <Navigate to="/" replace />

  const variant = locationVariant(detail)
  const newestPost = detail.posts.at(0)

  return (
    <>
      <button
        type="button"
        onClick={close}
        aria-label="Close detail panel"
        className="pointer-events-auto absolute inset-0 z-[1001] cursor-default bg-scrim"
      />

      <aside
        aria-label={`${watch.name} detail`}
        className="scroll-thin pointer-events-auto absolute inset-y-0 right-0 z-[1002] w-[420px] max-w-full overflow-y-auto border-l border-line bg-surface shadow-[-8px_0_24px_rgba(0,0,0,.28)]"
      >
        <div className="flex flex-col gap-3.5 p-4">
          <header className="flex items-center gap-2.5 border-b border-line pb-3">
            <CategorySwatch category={watch.category} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-bold text-fg">{watch.name}</h2>
              <p className="text-[11px] text-fg-muted">
                {CATEGORIES[watch.category].label} · {watch.count} items
                {newestPost && ` · ${newestPost.time} ago`}
              </p>
            </div>
            <IconButton size="md" title="Close detail panel" onClick={close}>
              <X className="size-4" aria-hidden />
            </IconButton>
          </header>

          <section className="rounded-xl border border-accent-line bg-accent-soft p-3">
            <h3 className="mb-2 flex items-center gap-1.5 label-micro text-accent">
              <Sparkles className="size-3.5" aria-hidden />
              AI INSIGHTS · POSTS ON THIS TOPIC
            </h3>
            <ul className="flex flex-col gap-2">
              {detail.insights.map((insight) => (
                <li key={insight} className="flex gap-2">
                  <span aria-hidden className="mt-1.5 size-[5px] flex-none rounded-full bg-accent" />
                  <span className="text-xs leading-snug text-fg">{insight}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <FieldLabel>POSTS ON THIS TOPIC · {detail.posts.length}</FieldLabel>
            <div className="flex flex-col gap-2.5">
              {detail.posts.map((post, index) => (
                <PostCard key={`${post.handle}-${index}`} post={post} />
              ))}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>LOCATION</FieldLabel>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold',
                  variant.className,
                )}
              >
                <MapPin className="size-3" aria-hidden /> {variant.label}
              </span>
              <p className="mt-1.5 font-mono text-[11px] text-fg-muted">{detail.coordinates}</p>
              <p className="mt-0.5 text-[11px] text-fg-subtle">{detail.location}</p>
            </div>

            <div>
              <FieldLabel>CONFIDENCE</FieldLabel>
              <div className="flex items-center gap-2">
                <ConfidenceMeter score={detail.confidence} />
                <span className="text-xs font-semibold text-fg">{confidenceLabel(detail.confidence)}</span>
              </div>

              <div className="mt-2.5">
                <FieldLabel>CATEGORY</FieldLabel>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg">
                    <CategorySwatch category={watch.category} shape="circle" className="size-[9px]" />
                    {CATEGORIES[watch.category].label}
                  </span>
                  <SuggestedTag />
                </div>
              </div>
            </div>
          </section>

          {detail.locationNote && (
            <p className="flex items-start gap-2 rounded-lg border border-status-missing/30 bg-status-missing/10 p-2.5 text-[11px] leading-snug font-semibold text-status-missing">
              <MapPin className="mt-px size-3.5 flex-none" aria-hidden />
              {detail.locationNote}
            </p>
          )}

          <footer className="flex flex-wrap gap-2 border-t border-line pt-3">
            <ActionButton icon={<Check className="size-3.5" aria-hidden />} label="Confirm" />
            <ActionButton icon={<Ban className="size-3.5" aria-hidden />} label="Dismiss" />
            <ActionButton icon={<Flag className="size-3.5" aria-hidden />} label="Flag" danger />
            <ActionButton icon={<PenLine className="size-3.5" aria-hidden />} label="Annotate" />
          </footer>
        </div>
      </aside>
    </>
  )
}
