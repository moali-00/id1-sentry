import { useEffect, useId, useRef, useState } from 'react'
import { Crosshair, Loader2, MapPin, Radar, Search, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { geocode } from '@/api/geocode'
import { CATEGORIES } from '@/utils/constants'
import { useAppSelector } from '@/store/store'
import { selectClusters, selectWatches } from '@/store/slices/monitoringSlice'
import { selectAoi } from '@/store/slices/itrSlice'
import { WATCHES_ENABLED } from '@/utils/layers'
import { IconButton } from '@/components/ui/IconButton'
import { Panel } from '@/components/ui/Panel'

/**
 * How long typing settles before a geocode request goes out.
 *
 * Half a second rather than a snappier 250ms: the default geocoder is
 * OpenStreetMap's public Nominatim, whose usage policy asks for no more than
 * about one request a second.
 */
const DEBOUNCE_MS = 500

/** `40.7128, -74.006` and `40.7128 -74.006` both parse. */
const COORD_PATTERN = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/

type HitKind = 'coordinates' | 'watch' | 'place'

interface SearchHit {
  id: string
  kind: HitKind
  label: string
  context: string
  lat: number
  lng: number
  zoom?: number
  /** Set for watch hits — selecting one opens its detail panel. */
  watchId?: string
}

const KIND_ICON = { coordinates: Crosshair, watch: Radar, place: MapPin } as const

interface SearchBarProps {
  onSelect: (hit: SearchHit) => void
  /** Increments whenever a keyboard shortcut asks for the field. */
  focusToken?: number
}

/**
 * Resolve free text to a place on the map.
 *
 * Three resolvers in priority order — a coordinate pair, one of the operator's
 * own watches, then the geocoder. The first two are local, so the search stays
 * useful with no backend configured; `geocode` simply returns nothing then.
 */
export function SearchBar({ onSelect, focusToken = 0 }: SearchBarProps) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  // Zero is the initial value, so the field is not stolen on first paint.
  useEffect(() => {
    if (focusToken > 0) inputRef.current?.focus()
  }, [focusToken])

  const watches = useAppSelector(selectWatches)
  const clusters = useAppSelector(selectClusters)
  const aoi = useAppSelector(selectAoi)

  const [query, setQuery] = useState('')
  // Geocoder results are stored with the query that produced them, so a result
  // set for stale input is simply not shown — no effect has to clear it.
  const [geocoded, setGeocoded] = useState<{ query: string; hits: SearchHit[] }>({ query: '', hits: [] })
  // Likewise for the highlighted row: it resets by belonging to a query.
  const [highlight, setHighlight] = useState<{ query: string; index: number }>({ query: '', index: 0 })

  const trimmed = query.trim()

  // ── Local resolvers ──
  const localHits: SearchHit[] = []

  const coordMatch = COORD_PATTERN.exec(trimmed)
  if (coordMatch) {
    const lat = Number(coordMatch[1])
    const lng = Number(coordMatch[2])
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      localHits.push({
        id: 'coords',
        kind: 'coordinates',
        label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        context: 'Coordinates',
        lat,
        lng,
        zoom: 8,
      })
    }
  }

  if (trimmed.length >= 2) {
    const needle = trimmed.toLowerCase()

    // The monitored target, matched on its name or any of its aliases.
    if (aoi) {
      const names = [aoi.target.name, ...(aoi.target.aliases ?? [])]
      if (names.some((name) => name.toLowerCase().includes(needle))) {
        localHits.push({
          id: 'target-itr',
          kind: 'watch',
          label: aoi.target.name,
          context: aoi.target.facility ?? 'Monitored target',
          lat: aoi.target.centre.lat,
          lng: aoi.target.centre.lon,
          zoom: 11,
        })
      }
    }

    // Demo watches are hidden from the map while watches are disabled, so they
    // must not be reachable from search either.
    if (WATCHES_ENABLED) {
      for (const watch of watches) {
        if (!watch.name.toLowerCase().includes(needle)) continue
        const cluster = clusters.find((candidate) => candidate.watchId === watch.id)
        if (!cluster) continue
        localHits.push({
          id: `watch-${watch.id}`,
          kind: 'watch',
          label: watch.name,
          context: `${CATEGORIES[watch.category].label} · ${watch.count} items`,
          lat: cluster.lat,
          lng: cluster.lng,
          watchId: watch.id,
        })
      }
    }
  }

  // ── Geocoder ──
  // A coordinate pair is already resolved, and one or two characters match
  // everything — neither is worth a round trip.
  const shouldGeocode = trimmed.length >= 3 && !COORD_PATTERN.test(trimmed)

  useEffect(() => {
    if (!shouldGeocode) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      geocode(trimmed, { signal: controller.signal })
        .then((results) =>
          setGeocoded({
            query: trimmed,
            hits: results.map((result) => ({
              id: `place-${result.id}`,
              kind: 'place' as const,
              label: result.label,
              context: result.context,
              lat: result.lat,
              lng: result.lng,
              zoom: result.zoom,
            })),
          }),
        )
        // A geocoder that is absent or unreachable degrades to local hits only.
        .catch(() => setGeocoded({ query: trimmed, hits: [] }))
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [trimmed, shouldGeocode])

  const places = geocoded.query === trimmed ? geocoded.hits : []
  const searching = shouldGeocode && geocoded.query !== trimmed

  const hits = [...localHits, ...places]
  const open = trimmed.length > 0
  const activeIndex = highlight.query === trimmed ? Math.min(highlight.index, Math.max(hits.length - 1, 0)) : 0

  const setActiveIndex = (index: number) => setHighlight({ query: trimmed, index })

  const choose = (hit: SearchHit | undefined) => {
    if (!hit) return
    onSelect(hit)
    setQuery('')
    inputRef.current?.blur()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(Math.min(activeIndex + 1, hits.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(Math.max(activeIndex - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(hits[activeIndex])
    } else if (event.key === 'Escape') {
      // Stop here rather than letting the map's Escape handler close a panel.
      event.stopPropagation()
      setQuery('')
    }
  }

  return (
    <div className="pointer-events-auto relative w-[340px]">
      <Panel className="flex items-center gap-2 rounded-full py-1.5 pr-1.5 pl-3.5">
        {searching ? (
          <Loader2 className="size-3.5 flex-none animate-spin text-fg-subtle" aria-hidden />
        ) : (
          <Search className="size-3.5 flex-none text-fg-subtle" aria-hidden />
        )}

        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label="Search watches, places or coordinates"
          placeholder="Search watch, place or 24.86, 67.00"
          className="min-w-0 flex-1 bg-transparent py-1 text-xs text-fg placeholder:text-fg-subtle focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />

        {query.length > 0 && (
          <IconButton title="Clear search" onClick={() => setQuery('')} className="rounded-full">
            <X className="size-3.5" aria-hidden />
          </IconButton>
        )}
      </Panel>

      {open && (
        <Panel className="scroll-thin absolute top-[calc(100%+6px)] left-0 max-h-72 w-full overflow-y-auto py-1.5">
          <ul id={listId} role="listbox" className="flex flex-col">
            {hits.map((hit, index) => {
              const Icon = KIND_ICON[hit.kind]

              return (
                <li key={hit.id} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(hit)}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                      index === activeIndex ? 'bg-active' : 'hover:bg-hover',
                    )}
                  >
                    <Icon className="size-3.5 flex-none text-fg-subtle" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-fg">{hit.label}</span>
                      <span className="block truncate text-[11px] text-fg-subtle">{hit.context}</span>
                    </span>
                  </button>
                </li>
              )
            })}

            {hits.length === 0 && !searching && (
              <li className="px-3 py-3 text-center text-[11px] text-fg-subtle">
                No match. Try a watch name or a coordinate pair.
              </li>
            )}
          </ul>
        </Panel>
      )}
    </div>
  )
}

export type { SearchHit }
