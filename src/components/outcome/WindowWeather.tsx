import type { WeatherHour } from '@/types/outcome'

/**
 * The four hours inside 819/26's declared 1230–1530Z window, as measured.
 *
 * A table, not a chart. Four rows against four measures in different units is
 * exactly the case where a plot loses to the numbers — and the numbers are the
 * argument here, because the pre-event forecast graded this day unfavourable on
 * cloud cover while rain and wind, the constraints that actually bind, were
 * benign for the two hours that mattered.
 *
 * Gust and rain carry a magnitude bar behind the figure, on one hue, scaled
 * across the whole table so the rise from 12Z to 15Z reads at a glance. Cloud
 * needs no bar: it is 100% in every row, which is the point. Visibility is left
 * as a bare figure because it falls where the others rise, and a bar that grows
 * as conditions worsen next to one that shrinks would read as contradiction.
 */

/** Column scales, fixed rather than derived — these are physical, not relative. */
const GUST_FULL_MS = 12
const RAIN_FULL_MM = 2

function Magnitude({ value, full, unit }: { value: number; full: number; unit: string }) {
  return (
    <span className="relative flex items-center justify-end gap-1 px-1">
      <span
        aria-hidden
        className="absolute inset-y-[3px] left-0 rounded-[2px] bg-accent/18"
        style={{ width: `${Math.min(100, (value / full) * 100)}%` }}
      />
      <span className="numeric relative text-[10px] text-fg">
        {value.toFixed(1)}
        <span className="text-fg-subtle"> {unit}</span>
      </span>
    </span>
  )
}

export function WindowWeather({ hours }: { hours: WeatherHour[] }) {
  return (
    <figure className="m-0 overflow-hidden rounded-lg border border-line bg-inset">
      <table className="w-full border-collapse">
        <caption className="sr-only">
          Measured conditions over the pad during the declared 1230–1530Z window on 6 August 2026
        </caption>
        <thead>
          <tr className="border-b border-line-soft">
            <th scope="col" className="label-micro px-2 py-1.5 text-left text-fg-subtle">
              UTC
            </th>
            <th scope="col" className="label-micro px-1 py-1.5 text-right text-fg-subtle">
              CLOUD
            </th>
            <th scope="col" className="label-micro px-1 py-1.5 text-right text-fg-subtle">
              GUST
            </th>
            <th scope="col" className="label-micro px-1 py-1.5 text-right text-fg-subtle">
              RAIN
            </th>
            <th scope="col" className="label-micro px-2 py-1.5 text-right text-fg-subtle">
              VIS
            </th>
          </tr>
        </thead>
        <tbody>
          {hours.map((hour) => (
            <tr key={hour.time} className="border-b border-line-soft last:border-b-0">
              <th scope="row" className="numeric px-2 py-1.5 text-left text-[10px] font-bold text-fg">
                {hour.time.slice(11, 16)}
              </th>
              <td className="numeric px-1 py-1.5 text-right text-[10px] text-fg-muted">{hour.cloud_cover}%</td>
              <td className="py-1.5 text-right">
                <Magnitude value={hour.wind_gusts_10m} full={GUST_FULL_MS} unit="m/s" />
              </td>
              <td className="py-1.5 text-right">
                <Magnitude value={hour.precipitation} full={RAIN_FULL_MM} unit="mm" />
              </td>
              <td className="numeric px-2 py-1.5 text-right text-[10px] text-fg-muted">
                {(hour.visibility / 1000).toFixed(1)} km
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
