import { categoryColor } from '@/utils/constants'
import { withAlpha } from '@/utils/color'
import { SMALL_MARKER_SIZE } from '@/utils/markerGeometry'
import type { Cluster } from '@/types/monitoring'

/**
 * A numbered circle — the marker for a watch cluster.
 *
 * Sizes and hues are inline styles rather than Tailwind classes because they are
 * *values*: the diameter comes from `Cluster.size` and the hue from the threat
 * category, which is fixed across themes so the legend stays learnable. The two
 * theme-reactive pieces still come from CSS custom properties.
 */
export function ClusterMarker({
  cluster,
  active,
  isLight,
}: {
  cluster: Cluster
  /** Hovered or selected — draws a halo ring. */
  active: boolean
  /** The fill sits lighter on the light basemap so the count stays legible. */
  isLight: boolean
}) {
  const color = categoryColor(cluster.category)
  const { size } = cluster

  // Inferred positions are hatched rather than solid — a standing visual cue
  // that the coordinates came from account metadata, not a geotag.
  const background = cluster.inferred
    ? `repeating-linear-gradient(45deg, ${withAlpha(color, 0.06)}, ${withAlpha(color, 0.06)} 4px, ` +
      `${withAlpha(color, 0.24)} 4px, ${withAlpha(color, 0.24)} 8px)`
    : withAlpha(color, isLight ? 0.18 : 0.24)

  return (
    <div
      className={cluster.fresh ? 'sentry-bloom' : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        boxSizing: 'border-box',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: size <= SMALL_MARKER_SIZE ? 11 : 14,
        border: `${cluster.stale ? 2 : 3}px ${cluster.inferred ? 'dashed' : 'solid'} ${color}`,
        color,
        background,
        boxShadow: active ? `0 0 0 3px var(--c-ring), 0 0 0 5px ${color}` : undefined,
        // Consumed by the `sentry-bloom` keyframes.
        ['--bloom' as string]: withAlpha(color, 0.5),
      }}
    >
      {cluster.count}
    </div>
  )
}
