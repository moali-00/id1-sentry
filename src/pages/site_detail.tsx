import { useCallback } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { MapPin, X } from 'lucide-react'
import { PostCard } from '@/components/monitoring/PostCard'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { selectItrStatus, selectSocialClusters, selectSocialSiteDetails } from '@/store/slices/itrSlice'
import { selectCluster } from '@/store/slices/monitoringSlice'
import { CATEGORIES } from '@/utils/constants'
import { CategorySwatch, SuggestedTag } from '@/components/ui/Badges'
import { FieldLabel } from '@/components/ui/FieldLabel'
import { IconButton } from '@/components/ui/IconButton'

/**
 * The reporting that names one site, opened as a nested route (`/site/:siteId`).
 *
 * The topic-detail pattern the dashboard already had, pointed at a place rather
 * than at a watch: the posts themselves, read in full, with their pictures and a
 * link to each original.
 *
 * The location block says INFERRED and means it. No post here carried a position
 * — every one of them was placed by the name it mentioned — so the panel states
 * that plainly rather than letting a coordinate imply an observation.
 */
export default function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const details = useAppSelector(selectSocialSiteDetails)
  const clusters = useAppSelector(selectSocialClusters)
  const status = useAppSelector(selectItrStatus)

  const close = useCallback(() => {
    dispatch(selectCluster(null))
    void navigate('/')
  }, [dispatch, navigate])

  useEscapeKey(close)

  const site = siteId ? details.get(siteId) : undefined
  const cluster = clusters.find((candidate) => candidate.watchId === siteId)

  // On a cold deep link the posts have not arrived yet, and bouncing straight
  // back to the map would make a shared `/site/:id` link useless. Only treat a
  // missing site as a stale link once the feeds have actually settled.
  if (!site || !cluster) return status === 'loading' ? null : <Navigate to="/" replace />

  const newest = site.posts.at(0)

  return (
    <>
      <button
        type="button"
        onClick={close}
        aria-label="Close detail panel"
        className="pointer-events-auto absolute inset-0 z-[1001] cursor-default bg-scrim"
      />

      <aside
        aria-label={`${site.name} reporting`}
        className="scroll-thin pointer-events-auto absolute inset-y-0 right-0 z-[1002] w-[420px] max-w-full overflow-y-auto border-l border-line bg-surface shadow-[-8px_0_24px_rgba(0,0,0,.28)]"
      >
        <div className="flex flex-col gap-3.5 p-4">
          <header className="flex items-center gap-2.5 border-b border-line pb-3">
            <CategorySwatch category={cluster.category} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-bold text-fg">{site.name}</h2>
              <p className="text-[11px] text-fg-muted">
                {CATEGORIES[cluster.category].label} · {site.posts.length} posts
                {newest && ` · newest ${newest.time} ago`}
              </p>
            </div>
            <IconButton size="md" title="Close detail panel" onClick={close}>
              <X className="size-4" aria-hidden />
            </IconButton>
          </header>

          <section className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>LOCATION</FieldLabel>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-status-inferred/30 bg-status-inferred/10 px-2 py-1 text-[10px] font-bold text-status-inferred">
                <MapPin className="size-3" aria-hidden /> INFERRED · named in text
              </span>
              <p className="mt-1.5 font-mono text-[11px] text-fg-muted">
                {site.lat.toFixed(4)}, {site.lng.toFixed(4)}
              </p>
              <p className="mt-0.5 text-[11px] text-fg-subtle">{site.name}</p>
            </div>

            <div>
              <FieldLabel>CATEGORY</FieldLabel>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg">
                  <CategorySwatch category={cluster.category} shape="circle" className="size-[9px]" />
                  {CATEGORIES[cluster.category].label}
                </span>
                <SuggestedTag />
              </div>
            </div>
          </section>

          <p className="flex items-start gap-2 rounded-lg border border-status-inferred/30 bg-status-inferred/10 p-2.5 text-[11px] leading-snug font-semibold text-status-inferred">
            <MapPin className="mt-px size-3.5 flex-none" aria-hidden />
            These posts named {site.name}; none of them carried a location of its own.
          </p>

          <section>
            <FieldLabel>POSTS NAMING THIS SITE · {site.posts.length}</FieldLabel>
            <div className="flex flex-col gap-2.5">
              {site.posts.map((post) => (
                <PostCard key={post.url ?? `${post.handle}-${post.time}`} post={post} />
              ))}
            </div>
          </section>
        </div>
      </aside>
    </>
  )
}
