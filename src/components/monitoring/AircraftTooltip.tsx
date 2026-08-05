import { FeatureTooltip } from '@/components/monitoring/FeatureTooltip'
import { selectFlightsByHex } from '@/store/slices/flightsSlice'
import { useAppSelector } from '@/store/store'
import {
  aircraftModel,
  aircraftTitle,
  altitudeLabel,
  isStale,
  routeLabel,
  speedLabel,
  verticalRateLabel,
} from '@/utils/flights'

/**
 * The hover card for a live contact.
 *
 * Reads the aircraft out of the store by `hex` rather than taking it as a prop,
 * because the map features carry only an id: the numbers here update twice a
 * second while the tooltip is open, and baking them into 40 GeoJSON features 25
 * times a second to achieve the same thing would be absurd.
 *
 * Renders through the shared `FeatureTooltip` so a hovered aircraft looks like a
 * hovered danger area — same four-part order, same explanatory footer.
 */
export function AircraftTooltip({ hex }: { hex: string }) {
  const byHex = useAppSelector(selectFlightsByHex)
  const aircraft = byHex[hex]

  // The contact can leave the region between the hover landing and this rendering.
  if (!aircraft) return null

  const measurements = [altitudeLabel(aircraft), speedLabel(aircraft), verticalRateLabel(aircraft)]
    .filter((part) => part !== '—')
    .join(' · ')

  const identity = [aircraftModel(aircraft), routeLabel(aircraft), aircraft.aircraft?.operator]
    .filter(Boolean)
    .join(' · ')

  // Staleness is stated rather than only dimmed: the icon's reduced opacity says
  // something is wrong, this says what.
  const provenance = [identity, isStale(aircraft) ? 'Position stale' : null].filter(Boolean).join(' · ')

  return (
    <FeatureTooltip
      layerId="itr_aircraft"
      title={aircraftTitle(aircraft)}
      detail={measurements || undefined}
      meta={provenance || undefined}
    />
  )
}
