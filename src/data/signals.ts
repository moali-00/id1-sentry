import type { MapPoint, SignalLayerId } from '@/types/monitoring'

/**
 * Fixture corpus for the signal layers.
 *
 * Stands in for the API until it exists (see `src/api/monitoring.ts`). Ages are
 * declared as minutes-ago and resolved against module-load time so the markers
 * read as live rather than as a frozen snapshot from whenever the file was
 * written.
 */

const LOADED_AT = Math.floor(Date.now() / 1000)

const minutesAgo = (minutes: number): number => LOADED_AT - minutes * 60

type Seed = Omit<MapPoint, 'layerId' | 'timestamp'> & { agoMinutes: number }

const build = (layerId: SignalLayerId, seeds: Seed[]): MapPoint[] =>
  seeds.map(({ agoMinutes, ...rest }) => ({ ...rest, layerId, timestamp: minutesAgo(agoMinutes) }))

const INCIDENTS = build('global_incidents', [
  {
    id: 'inc-1',
    lat: 50.45,
    lng: 30.52,
    label: 'Kyiv',
    detail: 'Air-defence activity reported',
    severity: 4,
    agoMinutes: 12,
  },
  {
    id: 'inc-2',
    lat: 31.5,
    lng: 34.47,
    label: 'Gaza strip',
    detail: 'Border crossing closure',
    severity: 5,
    agoMinutes: 34,
  },
  {
    id: 'inc-3',
    lat: 15.59,
    lng: 32.53,
    label: 'Khartoum',
    detail: 'Clashes near the airport',
    severity: 4,
    agoMinutes: 71,
  },
  {
    id: 'inc-4',
    lat: 33.51,
    lng: 36.29,
    label: 'Damascus',
    detail: 'Convoy movement observed',
    severity: 3,
    agoMinutes: 96,
  },
  {
    id: 'inc-5',
    lat: 4.71,
    lng: -74.07,
    label: 'Bogotá',
    detail: 'Large-scale demonstration',
    severity: 2,
    agoMinutes: 140,
  },
  {
    id: 'inc-6',
    lat: 24.86,
    lng: 67.0,
    label: 'Karachi',
    detail: 'Port access disruption',
    severity: 3,
    agoMinutes: 165,
  },
  {
    id: 'inc-7',
    lat: 12.65,
    lng: 43.14,
    label: 'Bab el-Mandeb',
    detail: 'Vessel hailed on VHF',
    severity: 4,
    agoMinutes: 190,
  },
  {
    id: 'inc-8',
    lat: 48.15,
    lng: 37.75,
    label: 'Donetsk oblast',
    detail: 'Artillery exchange',
    severity: 5,
    agoMinutes: 220,
  },
])

const EARTHQUAKES = build('earthquakes', [
  { id: 'eq-1', lat: 38.25, lng: 38.05, label: 'M5.4 · Elazığ', detail: 'Depth 10 km', severity: 4, agoMinutes: 46 },
  { id: 'eq-2', lat: -8.35, lng: 116.5, label: 'M4.8 · Lombok', detail: 'Depth 32 km', severity: 3, agoMinutes: 88 },
  { id: 'eq-3', lat: 35.68, lng: 139.69, label: 'M4.2 · Honshū', detail: 'Depth 55 km', severity: 2, agoMinutes: 133 },
  {
    id: 'eq-4',
    lat: -33.45,
    lng: -70.67,
    label: 'M5.1 · Valparaíso',
    detail: 'Depth 78 km',
    severity: 4,
    agoMinutes: 205,
  },
  {
    id: 'eq-5',
    lat: 61.22,
    lng: -149.9,
    label: 'M4.6 · Anchorage',
    detail: 'Depth 41 km',
    severity: 3,
    agoMinutes: 340,
  },
  {
    id: 'eq-6',
    lat: 27.72,
    lng: 85.32,
    label: 'M4.9 · Kathmandu',
    detail: 'Depth 15 km',
    severity: 3,
    agoMinutes: 500,
  },
  {
    id: 'eq-7',
    lat: -17.73,
    lng: 168.31,
    label: 'M5.7 · Vanuatu',
    detail: 'Depth 120 km',
    severity: 5,
    agoMinutes: 690,
  },
])

const LIVE_NEWS = build('live_news', [
  {
    id: 'news-1',
    lat: 50.85,
    lng: 4.35,
    label: 'Brussels',
    detail: 'Emergency council session called',
    severity: 3,
    agoMinutes: 8,
  },
  {
    id: 'news-2',
    lat: 38.9,
    lng: -77.04,
    label: 'Washington DC',
    detail: 'Sanctions package announced',
    severity: 3,
    agoMinutes: 25,
  },
  {
    id: 'news-3',
    lat: 55.75,
    lng: 37.62,
    label: 'Moscow',
    detail: 'Ministry briefing under way',
    severity: 2,
    agoMinutes: 52,
  },
  {
    id: 'news-4',
    lat: 39.9,
    lng: 116.4,
    label: 'Beijing',
    detail: 'Export controls extended',
    severity: 3,
    agoMinutes: 110,
  },
  {
    id: 'news-5',
    lat: 24.71,
    lng: 46.68,
    label: 'Riyadh',
    detail: 'Production quota statement',
    severity: 2,
    agoMinutes: 175,
  },
  {
    id: 'news-6',
    lat: 6.52,
    lng: 3.38,
    label: 'Lagos',
    detail: 'Pipeline outage confirmed',
    severity: 3,
    agoMinutes: 240,
  },
])

const MARITIME = build('maritime', [
  {
    id: 'sea-1',
    lat: 30.02,
    lng: 32.58,
    label: 'Suez Canal',
    detail: 'Southbound convoy delayed',
    severity: 4,
    agoMinutes: 18,
  },
  {
    id: 'sea-2',
    lat: 26.57,
    lng: 56.25,
    label: 'Strait of Hormuz',
    detail: 'Escorted transit',
    severity: 5,
    agoMinutes: 40,
  },
  {
    id: 'sea-3',
    lat: 1.26,
    lng: 103.83,
    label: 'Singapore Strait',
    detail: 'AIS gap · 40 min',
    severity: 3,
    agoMinutes: 63,
  },
  {
    id: 'sea-4',
    lat: 41.02,
    lng: 28.98,
    label: 'Bosphorus',
    detail: 'Traffic suspended northbound',
    severity: 3,
    agoMinutes: 120,
  },
  {
    id: 'sea-5',
    lat: 9.0,
    lng: -79.55,
    label: 'Panama Canal',
    detail: 'Draft restriction in force',
    severity: 2,
    agoMinutes: 210,
  },
  {
    id: 'sea-6',
    lat: 35.94,
    lng: 14.38,
    label: 'Malta approaches',
    detail: 'Search-and-rescue tasking',
    severity: 3,
    agoMinutes: 300,
  },
])

export const SEED_POINTS: Record<SignalLayerId, MapPoint[]> = {
  global_incidents: INCIDENTS,
  earthquakes: EARTHQUAKES,
  live_news: LIVE_NEWS,
  maritime: MARITIME,
}
