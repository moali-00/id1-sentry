import { Minus, Navigation, Plus } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useMapController } from '@/components/monitoring/MapContext'
import { useMapCamera } from '@/hooks/useMapCamera'
import { useAppSelector } from '@/store/store'
import { selectRails } from '@/store/slices/monitoringSlice'
import { IconButton } from '@/components/ui/IconButton'

/**
 * Zoom buttons for the map. MapLibre's own NavigationControl is not mounted, so
 * these can sit clear of the activity rail — and shift left when that rail is
 * open. They also move in fractional steps, which the built-in control cannot.
 */
export function ZoomControls() {
  const { zoomIn, zoomOut, map } = useMapController()
  const { bearing, pitch } = useMapCamera()
  const activityOpen = useAppSelector(selectRails).activity

  // The camera can now be rotated and tilted, and a map that is a few degrees off
  // north is easy to misread and hard to notice. So the compass appears only once
  // the view has actually left north-up, and clicking it puts it back.
  const offNorth = Math.abs(bearing) > 0.5 || pitch > 0.5

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

      {offNorth && (
        <IconButton
          size="lg"
          title={`Reset north — bearing ${Math.round(bearing)}°, tilt ${Math.round(pitch)}°`}
          onClick={() => map?.easeTo({ bearing: 0, pitch: 0, duration: 500 })}
          className="animate-rise bg-panel text-accent shadow-lg backdrop-blur-sm"
        >
          {/* The needle points along the current heading, so the button reads as a
              compass rather than as a generic reset. */}
          <Navigation className="size-4" style={{ transform: `rotate(${-bearing}deg)` }} aria-hidden />
        </IconButton>
      )}
    </div>
  )
}
