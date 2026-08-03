import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, Clock, PenLine, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { ALL_PLATFORMS, DATE_RANGES, MATCH_PLACEHOLDER, VISIBLE_PLATFORM_COUNT, WATCH_TYPES } from '@/utils/constants'
import { RegionPicker } from '@/components/monitoring/RegionPicker'
import { useWatchDraft } from '@/hooks/useWatchDraft'
import type { WatchDraft } from '@/types/monitoring'
import { Chip } from '@/components/ui/Chip'
import { FieldLabel } from '@/components/ui/FieldLabel'
import { IconButton } from '@/components/ui/IconButton'
import { Spinner } from '@/components/ui/Spinner'

/** Simulated round-trip so saving reads as work rather than an instant jump. */
const SAVE_MS = 650

const FIELD_CLASSES =
  'w-full rounded-lg border border-line bg-inset px-3 py-2.5 text-[13px] text-fg outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-accent'

interface WatchFormModalProps {
  mode: 'create' | 'edit'
  initialDraft: WatchDraft
  onSave: (draft: WatchDraft) => void
  onClose: () => void
}

/** Create/edit form for a watch, presented as a modal over the map. */
export function WatchFormModal({ mode, initialDraft, onSave, onClose }: WatchFormModalProps) {
  const { draft, update, toggleInList } = useWatchDraft(initialDraft)
  const [saving, setSaving] = useState(false)
  const [showAllPlatforms, setShowAllPlatforms] = useState(false)
  const saveTimer = useRef<number | undefined>(undefined)

  const nameId = useId()
  const matchId = useId()
  const dateId = useId()

  useEffect(() => () => window.clearTimeout(saveTimer.current), [])
  useEscapeKey(onClose, !saving)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    saveTimer.current = window.setTimeout(() => {
      setSaving(false)
      onSave(draft)
    }, SAVE_MS)
  }

  const platforms = showAllPlatforms ? ALL_PLATFORMS : ALL_PLATFORMS.slice(0, VISIBLE_PLATFORM_COUNT)
  const hiddenPlatformCount = ALL_PLATFORMS.length - VISIBLE_PLATFORM_COUNT

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cancel"
        className="pointer-events-auto absolute inset-0 z-[1010] cursor-default bg-scrim-strong backdrop-blur-[1px]"
      />

      <div className="pointer-events-none absolute inset-0 z-[1011] grid place-items-center p-4">
        <form
          onSubmit={handleSubmit}
          aria-label={mode === 'edit' ? 'Edit watch' : 'New watch'}
          className="scroll-thin pointer-events-auto flex max-h-[calc(100%-2rem)] w-full max-w-[640px] flex-col overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl"
        >
          <header className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-line bg-surface px-5 py-3.5">
            <PenLine className="size-4 text-accent" aria-hidden />
            <h2 className="flex-1 text-[15px] font-bold text-fg">{mode === 'edit' ? 'Edit watch' : 'New watch'}</h2>
            <IconButton size="md" title="Close" onClick={onClose}>
              <X className="size-4" aria-hidden />
            </IconButton>
          </header>

          <div className="flex flex-col gap-4 px-5 py-4">
            <div>
              <FieldLabel htmlFor={nameId}>NAME</FieldLabel>
              <input
                id={nameId}
                value={draft.name}
                onChange={(event) => update('name', event.target.value)}
                autoFocus
                placeholder="Give this watch a name"
                className={FIELD_CLASSES}
              />
            </div>

            <div>
              <FieldLabel>TYPE</FieldLabel>
              <div className="inline-flex flex-wrap gap-1.5 rounded-lg border border-line bg-inset p-1">
                {WATCH_TYPES.map((type) => {
                  const active = draft.type === type.key
                  return (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => update('type', type.key)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                        active ? 'bg-accent font-bold text-white' : 'font-semibold text-fg-muted hover:text-fg',
                      )}
                    >
                      {type.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {draft.type === 'region' ? (
              <div>
                <FieldLabel>MATCH — DRAW A REGION ON THE MAP</FieldLabel>
                <RegionPicker hasRegion={draft.hasRegion} onChange={(value) => update('hasRegion', value)} />
              </div>
            ) : (
              <div>
                <FieldLabel htmlFor={matchId}>MATCH — {draft.type.toUpperCase()}</FieldLabel>
                <input
                  id={matchId}
                  value={draft.match}
                  onChange={(event) => update('match', event.target.value)}
                  placeholder={MATCH_PLACEHOLDER[draft.type]}
                  className={FIELD_CLASSES}
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>PLATFORMS</FieldLabel>
                <div className="flex flex-wrap items-center gap-1.5">
                  {platforms.map((platform) => (
                    <Chip
                      key={platform}
                      active={draft.platforms.includes(platform)}
                      onClick={() => toggleInList('platforms', platform)}
                    >
                      {platform}
                    </Chip>
                  ))}
                  {!showAllPlatforms && hiddenPlatformCount > 0 && (
                    <Chip active={false} dashed onClick={() => setShowAllPlatforms(true)}>
                      +{hiddenPlatformCount}
                    </Chip>
                  )}
                </div>
              </div>

              <div>
                <FieldLabel htmlFor={dateId}>DATE RANGE</FieldLabel>
                <div className="relative">
                  <Clock
                    className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-fg-muted"
                    aria-hidden
                  />
                  <select
                    id={dateId}
                    value={draft.dateRange}
                    onChange={(event) => update('dateRange', event.target.value)}
                    className={cn(FIELD_CLASSES, 'cursor-pointer appearance-none pr-8 pl-8 text-xs')}
                  >
                    {DATE_RANGES.map((range) => (
                      <option key={range} value={range} className="bg-surface text-fg">
                        {range}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-fg-muted"
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          </div>

          <footer className="sticky bottom-0 flex items-center gap-2 border-t border-line bg-surface px-5 py-3.5">
            <p className="flex-1 text-[11px] text-fg-subtle">
              Saving {mode === 'edit' ? 'updates' : 'adds a new'} layer
            </p>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-line bg-control px-4 py-2 text-xs font-semibold text-fg disabled:cursor-default disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex min-w-[116px] items-center justify-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-bold text-white shadow-lg disabled:cursor-default"
            >
              {saving ? (
                <>
                  <Spinner /> Saving…
                </>
              ) : (
                <>
                  <Check className="size-3.5" aria-hidden /> Save watch
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </>
  )
}
