import type { Post } from '@/types/monitoring'
import { PlatformBadge } from '@/components/ui/Badges'

/** At most this many images render per post; the rest are elided. */
const MAX_IMAGES = 4

/**
 * One source post inside the topic detail panel: its text and any imagery.
 *
 * The dashboard is English-only, so there is no original/translation split and
 * no bidirectional text handling — a post is shown as it is.
 */
export function PostCard({ post }: { post: Post }) {
  const images = post.images?.slice(0, MAX_IMAGES) ?? []

  return (
    <article className="flex flex-col gap-2.5 rounded-xl border border-line bg-inset p-3">
      <header className="flex items-center gap-1.5">
        <PlatformBadge platform={post.platform} />
        {post.author && <span className="truncate text-xs font-semibold text-fg">{post.author}</span>}
        <span className="truncate text-[11px] text-fg-subtle">{post.handle}</span>
        <span className="ml-auto flex-none text-[10px] text-fg-subtle">{post.time} ago</span>
      </header>

      <p className="text-[12.5px] leading-snug whitespace-pre-wrap text-fg">{post.text}</p>

      {images.length > 0 && (
        <div className={`grid gap-1.5 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {images.map((src, index) => (
            <img
              key={src}
              src={src}
              alt=""
              loading="lazy"
              // Vendor CDN links expire; hide a broken thumbnail rather than
              // leaving a torn-image placeholder in the panel.
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
              className="max-h-[200px] w-full rounded-lg border border-line object-cover"
              data-index={index}
            />
          ))}
        </div>
      )}

      {post.url && (
        <a
          href={post.url}
          target="_blank"
          rel="noreferrer"
          className="w-fit text-[11px] font-semibold text-accent hover:underline"
        >
          View original ↗
        </a>
      )}
    </article>
  )
}
