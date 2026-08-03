import { cn } from '@/utils/cn'
import { BASEMAPS, BASEMAP_IDS } from '@/utils/constants'
import { selectBasemap, setBasemap } from '@/store/slices/layersSlice'
import { useAppDispatch, useAppSelector } from '@/store/store'

/**
 * Basemap choice, at the top of the DISPLAY group.
 *
 * A segmented control rather than a layer toggle: the basemaps are mutually
 * exclusive, so an on/off row per option would let the operator pick a state
 * that cannot exist.
 */
export function BasemapPicker() {
  const dispatch = useAppDispatch()
  const active = useAppSelector(selectBasemap)

  return (
    <div className="mb-1 px-1">
      <p className="mb-1.5 text-[9.5px] font-bold tracking-[0.06em] text-fg-subtle">BASEMAP</p>
      <div className="grid grid-cols-2 gap-1">
        {BASEMAP_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => dispatch(setBasemap(id))}
            aria-pressed={active === id}
            className={cn(
              'rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors',
              'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
              active === id
                ? 'border-accent bg-accent text-white'
                : 'border-line bg-control text-fg-muted hover:text-fg',
            )}
          >
            {BASEMAPS[id].label}
          </button>
        ))}
      </div>
    </div>
  )
}
