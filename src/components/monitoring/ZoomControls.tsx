import { Minus, Plus } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useMapController } from '@/components/monitoring/MapContext'
import { useAppSelector } from '@/store/store'
import { selectRails } from '@/store/slices/monitoringSlice'
import { IconButton } from '@/components/ui/IconButton'

/**
 * Zoom buttons for the map. Leaflet's built-in control is disabled so these can
 * sit clear of the activity rail — and shift left when that rail is open.
 */
export function ZoomControls() {
  const { zoomIn, zoomOut } = useMapController()
  const activityOpen = useAppSelector(selectRails).activity

  return (
    <div
      className={cn(
        'pointer-events-auto absolute top-4 flex flex-col gap-1 transition-[right]',
        activityOpen ? 'right-[304px]' : 'right-[78px]',
      )}
    >
      <IconButton size="lg" title="Zoom in" onClick={zoomIn} className="bg-panel text-fg shadow-lg backdrop-blur-sm">
        <Plus className="size-4" aria-hidden />
      </IconButton>
      <IconButton size="lg" title="Zoom out" onClick={zoomOut} className="bg-panel text-fg shadow-lg backdrop-blur-sm">
        <Minus className="size-4" aria-hidden />
      </IconButton>
    </div>
  )
}
