import { layerColor } from '@/utils/layers'
import { REPORTING_HEIGHT } from '@/utils/markerGeometry'
import type { Cluster } from '@/types/monitoring'

/**
 * The count of posts naming a site.
 *
 * Deliberately not a cluster circle. Every other marker near the island is a
 * circle or a dashed box in a warm hue, and a yellow ring of posts beside a
 * yellow maritime warning was unreadable — same shape, same colour, overlapping.
 * So this is the one **solid pill** on the map, in a hue used nowhere else.
 *
 * It takes the layer's colour rather than the threat category's on purpose: the
 * count is not itself a threat, it is how much is being said about a place.
 */
export function ReportingMarker({ cluster, active }: { cluster: Cluster; active: boolean }) {
  const color = layerColor('itr_social')
  const label = String(cluster.count)

  return (
    <div
      style={{
        width: REPORTING_HEIGHT + 5 * label.length,
        height: REPORTING_HEIGHT,
        borderRadius: REPORTING_HEIGHT / 2,
        boxSizing: 'border-box',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: 10.5,
        letterSpacing: '.02em',
        color: '#fff',
        background: color,
        // A hairline in the page's own ring colour keeps the pill legible on both
        // the pale and the satellite basemaps without a second hue.
        border: '1.5px solid var(--c-ring)',
        boxShadow: active ? `0 0 0 2px var(--c-ring), 0 0 0 4px ${color}` : '0 1px 3px rgba(0,0,0,.35)',
      }}
    >
      {label}
    </div>
  )
}
