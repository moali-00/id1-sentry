import { createBrowserRouter, Navigate } from 'react-router-dom'
import MainLayout from '@/layouts/main_layout'
import AircraftDetailPage from '@/pages/aircraft_detail'
import CameraDetailPage from '@/pages/camera_detail'
import { RouteError } from '@/pages/route_error'
import OutcomeDetailPage from '@/pages/outcome_detail'
import SiteDetailPage from '@/pages/site_detail'
import TargetDetailPage from '@/pages/target_detail'
import WatchDetailPage from '@/pages/watch_detail'

/**
 * The dashboard is a single surface, so routing exists to make one thing
 * shareable: which watch is open. Anything unrecognised falls back to the map
 * rather than a dead end.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    errorElement: <RouteError />,
    children: [
      { path: 'target', element: <TargetDetailPage /> },
      { path: 'outcome', element: <OutcomeDetailPage /> },
      { path: 'site/:siteId', element: <SiteDetailPage /> },
      { path: 'watch/:watchId', element: <WatchDetailPage /> },
      { path: 'aircraft/:hex', element: <AircraftDetailPage /> },
      { path: 'camera/:cameraId', element: <CameraDetailPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
