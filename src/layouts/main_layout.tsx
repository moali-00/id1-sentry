import { Outlet } from 'react-router-dom'
import { MapCanvas } from '@/components/monitoring/MapCanvas'
import { MonitoringChrome } from '@/components/monitoring/MonitoringChrome'
import { MapProvider } from '@/components/monitoring/MapProvider'

/**
 * Root layout: one full-bleed map with the chrome floating over it.
 *
 * `<Outlet />` renders the routed overlays — currently the watch detail panel —
 * on top of the chrome, so a deep link opens straight into a topic.
 */
export default function MainLayout() {
  return (
    <MapProvider>
      <div className="relative h-full w-full overflow-hidden bg-sea">
        <MapCanvas />
        <MonitoringChrome />
        <Outlet />
      </div>
    </MapProvider>
  )
}
