import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Camera as CameraIcon, ExternalLink, MapPin, Play, RefreshCw, X } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useMapController } from '@/components/monitoring/MapContext'
import { useAppSelector } from '@/store/store'
import { selectCameraStatus, selectCamerasById } from '@/store/slices/camerasSlice'
import { isUsingCameraFixture } from '@/api/cctv'
import { FieldLabel } from '@/components/ui/FieldLabel'
import { IconButton } from '@/components/ui/IconButton'
import { buildFrameUrl, getCctvOperationalStatus, getLiveMode, inferRefreshIntervalSeconds } from '@/utils/cctv'
import type { Camera, CctvOperationalStatus } from '@/types/cctv'

/**
 * One camera, opened as a nested route (`/camera/:cameraId`).
 *
 * ## The panel's actual job
 *
 * Not "show a video" — most of these are not video. It is to show the picture
 * **together with how old it is**, because that is what decides whether the picture
 * means anything. A 60-second still of an empty road and a live stream of an empty
 * road are different observations, and a viewer that renders both under a red dot
 * has thrown away the distinction.
 *
 * So the status line is not decoration. `connecting` / `live` / `stale` / `offline`
 * come from `getCctvOperationalStatus`, and `stale` is the one that earns its keep: a
 * snapshot that has stopped updating looks identical to one that is merely between
 * refreshes, and only the clock can tell them apart.
 *
 * ## Three transports, one panel
 *
 * - **snapshot** — an `<img>` re-pointed at `/api/cctv-frame` on the source's own
 *   cadence. Never at the provider directly: no CORS, some are plain HTTP, and the
 *   cache has to be defeated per frame.
 * - **hls** — a `<video>` driven by hls.js, dynamically imported so its ~130 kB is
 *   not in the main bundle for the majority of cameras that never need it.
 * - **iframe** — the provider's player, behind a gate. Not autoplayed: a YouTube
 *   embed starts a full video decode, and opening three cameras in a row would put
 *   three of them behind a panel the operator has already navigated away from.
 */

/* ── Status ──────────────────────────────────────────────────────────────── */

const STATUS_STYLE: Record<CctvOperationalStatus, { tone: string; dot: string; label: string }> = {
  live: { tone: 'border-status-live/30 bg-status-live/10 text-fg', dot: 'bg-status-live animate-pulse-live', label: 'LIVE' },
  connecting: { tone: 'border-line bg-inset text-fg-muted', dot: 'bg-fg-subtle animate-pulse-live', label: 'CONNECTING' },
  stale: { tone: 'border-status-inferred/30 bg-status-inferred/10 text-fg', dot: 'bg-status-inferred', label: 'STALE' },
  offline: { tone: 'border-status-missing/30 bg-status-missing/10 text-fg', dot: 'bg-status-missing', label: 'OFFLINE' },
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s ago`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`
}

/* ── The media area ──────────────────────────────────────────────────────── */

/**
 * A snapshot camera.
 *
 * The refresh token, not the URL, is the state. Each tick builds a fresh proxied URL
 * with a new nonce, which is the only way to make the browser re-request an image it
 * believes it already has.
 *
 * Refreshing stops while the tab is hidden and fires once on return. A backgrounded
 * dashboard should neither burn proxy invocations nor come back showing a
 * ten-minute-old frame under a live label — the same rule `useLivePoll` follows.
 */
function SnapshotView({
  camera,
  manualToken,
  onFrame,
  onError,
}: {
  camera: Camera
  /** Bumped by the panel's "refresh now" button; combined with the auto counter. */
  manualToken: number
  onFrame: () => void
  onError: () => void
}) {
  const [autoToken, setAutoToken] = useState(0)
  /**
   * Captured once, in a lazy initialiser rather than during render.
   *
   * The nonce needs to differ between page loads as well as between refreshes — the
   * token restarts at zero on reload, and a URL identical to one the browser has
   * already seen can be served from its cache however emphatically the proxy says
   * `no-store`. Reading the clock in the render body instead would be an impure
   * render: two renders of the same state would produce two different `src` values,
   * so a re-render for an unrelated reason would silently re-request the frame.
   */
  const [mountedAt] = useState(() => Date.now())
  const cadenceMs = inferRefreshIntervalSeconds(camera) * 1000

  // Two sources, one token. The interval owns its own counter and the panel owns
  // the button's, so neither has to know about the other — and either one produces
  // a URL the browser has not seen.
  const token = autoToken + manualToken
  const src = useMemo(() => buildFrameUrl(camera.feed_url, token, mountedAt), [camera.feed_url, token, mountedAt])

  /**
   * Report a frame that had already decoded before React could listen for it.
   *
   * `onLoad` is attached after the element is in the document, so an image that
   * finishes first — a warm proxy, a small frame, anything from cache — fires its
   * load event into the void. The panel then sits on "CONNECTING · awaiting first
   * frame" with a perfectly good picture behind the overlay, which is precisely the
   * lie about currency this viewer exists to prevent. So the ref asks the element
   * directly whether it is already complete.
   *
   * **`useCallback` is load-bearing.** An inline arrow here is a new function every
   * render, which makes React detach and re-attach the ref each time — and since
   * attaching calls `setState`, that is an infinite render loop. It throws
   * "Maximum update depth exceeded" and takes the whole panel down with it. A stable
   * identity means one attach per mounted frame, which is exactly once per token.
   *
   * Both paths can fire for the same frame; `onFrame` is idempotent.
   */
  const catchAlreadyLoaded = useCallback(
    (node: HTMLImageElement | null) => {
      if (node?.complete && node.naturalWidth > 0) onFrame()
    },
    [onFrame],
  )

  useEffect(() => {
    if (!camera.feed_url) return

    const tick = () => {
      if (document.visibilityState === 'visible') setAutoToken((current) => current + 1)
    }

    const timer = window.setInterval(tick, cadenceMs)
    document.addEventListener('visibilitychange', tick)
    // A camera that was unreachable while offline should retry the moment the
    // connection is back, rather than waiting out another full cadence.
    window.addEventListener('online', tick)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('online', tick)
    }
  }, [camera.feed_url, cadenceMs])

  if (!src) return null

  return (
    <img
      // Keyed on the token so React swaps the element rather than mutating `src`.
      // Mutating it leaves the previous frame on screen until the new one decodes,
      // which reads as a camera that has frozen.
      key={token}
      // `ref` as well as `onLoad`, and both are needed. See `catchAlreadyLoaded`.
      ref={catchAlreadyLoaded}
      src={src}
      alt={`Current view from ${camera.name}`}
      className="block size-full object-cover"
      onLoad={onFrame}
      onError={onError}
    />
  )
}

/**
 * An HLS camera.
 *
 * hls.js is imported dynamically for bundle size, which makes the load racy: the
 * panel can close before the module resolves, so the effect checks whether it is
 * still mounted before attaching anything to a video element that may be gone.
 *
 * Safari plays HLS natively and does not need the library at all, so it is only
 * reached for when `isSupported()` says the MSE path is required.
 */
function HlsView({ camera, onFrame, onError }: { camera: Camera; onFrame: () => void; onError: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    const url = camera.stream_url
    if (!video || !url) return

    let disposed = false
    let destroy: (() => void) | undefined

    // Native HLS — Safari and iOS. No library, no MSE.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
      const handleReady = () => {
        onFrame()
        void video.play().catch(() => {
          // Autoplay refused. The frame is decoded and the controls are there.
        })
      }
      video.addEventListener('loadedmetadata', handleReady)
      return () => video.removeEventListener('loadedmetadata', handleReady)
    }

    void import('hls.js')
      .then(({ default: Hls }) => {
        if (disposed || !Hls.isSupported()) {
          if (!disposed) onError()
          return
        }

        // Buffers kept short deliberately. This is a live camera — being thirty
        // seconds behind to avoid one stall is the wrong trade.
        const hls = new Hls({ enableWorker: false, maxBufferLength: 8, backBufferLength: 8 })
        hls.loadSource(url)
        hls.attachMedia(video)

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          onFrame()
          void video.play().catch(() => {})
        })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          // Non-fatal errors are routine on a live edge — hls.js recovers from them
          // on its own, and surfacing them would flicker the status to OFFLINE
          // several times a minute on a perfectly good stream.
          if (data.fatal) onError()
        })

        destroy = () => hls.destroy()
      })
      .catch(onError)

    return () => {
      disposed = true
      destroy?.()
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [camera.stream_url, onFrame, onError])

  return <video ref={videoRef} className="block size-full object-cover" autoPlay muted playsInline preload="metadata" />
}

/* ── The viewer ──────────────────────────────────────────────────────────── */

/**
 * The panel body for one camera.
 *
 * Split from the route component and **mounted with `key={camera.id}`**, which is
 * what resets its frame state when the operator moves between cameras. Doing that
 * with an effect that calls four setters on a `cameraId` change works, but it means
 * a render pass where the new camera is paired with the old one's frame timestamp —
 * so the age readout briefly credits it with a frame it never received, and the
 * status pill can flash `stale` on a camera that has not loaded yet. Remounting has
 * no such window: there is no first render with the wrong state in it.
 */
function CameraViewer({ camera, close }: { camera: Camera; close: () => void }) {
  const { flyTo } = useMapController()

  const [lastFrameAt, setLastFrameAt] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  /** Iframe and its decode cost stay off until asked for. */
  const [armed, setArmed] = useState(false)
  /** Ticks the clock so the age readout counts up without the frame changing. */
  const [now, setNow] = useState(() => Date.now())
  /** Bumped by "refresh now". Drives a new frame request, not just a new timestamp. */
  const [manualToken, setManualToken] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const onFrame = useCallback(() => {
    setLastFrameAt(Date.now())
    setFailed(false)
  }, [])
  const onError = useCallback(() => setFailed(true), [])

  const mode = getLiveMode(camera)
  const cadence = inferRefreshIntervalSeconds(camera)
  const providerUrl = camera.external_url ?? camera.stream_url ?? camera.feed_url

  const status = getCctvOperationalStatus({
    mode,
    // An external camera is never "connecting" — there is nothing to connect to, and
    // leaving it spinning forever would read as a camera that failed to load.
    loading: mode !== 'external' && lastFrameAt === null && !failed,
    error: failed,
    // Nothing here will ever produce a frame, so the status is settled on arrival.
    lastFrameAt: mode === 'external' ? now : lastFrameAt,
    now,
    refreshIntervalSeconds: cadence,
  })

  const style = STATUS_STYLE[mode === 'external' ? 'connecting' : status]
  const ageSeconds = lastFrameAt === null ? null : Math.max(0, Math.floor((now - lastFrameAt) / 1000))
  const nextRefresh = mode === 'snapshot' && ageSeconds !== null ? Math.max(0, cadence - ageSeconds) : null

  /** Autoplay params belong to the viewer, not the stored URL — see `curated.ts`. */
  const embedUrl = (() => {
    if (!camera.stream_url) return null
    try {
      const url = new URL(camera.stream_url)
      url.searchParams.set('autoplay', '1')
      url.searchParams.set('mute', '1')
      url.searchParams.set('playsinline', '1')
      return url.toString()
    } catch {
      return camera.stream_url
    }
  })()

  return (
    <>
      <button
        type="button"
        onClick={close}
        aria-label="Close camera viewer"
        className="pointer-events-auto absolute inset-0 z-[1001] cursor-default bg-scrim"
      />

      <aside
        aria-label={`${camera.name} camera`}
        className="scroll-thin pointer-events-auto absolute inset-y-0 right-0 z-[1002] w-[420px] max-w-full overflow-y-auto border-l border-line bg-surface shadow-[-8px_0_24px_rgba(0,0,0,.28)]"
      >
        <div className="flex flex-col gap-3.5 p-4">
          <header className="flex items-center gap-2.5 border-b border-line pb-3">
            <span
              aria-hidden
              className="grid size-7 flex-none place-items-center rounded-md border border-line bg-inset"
            >
              <CameraIcon className="size-3.5 text-fg-muted" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-bold text-fg">{camera.name}</h2>
              <p className="truncate text-[11px] text-fg-muted">
                {[camera.city, camera.country].filter(Boolean).join(', ') || 'Location as published'}
              </p>
            </div>
            <IconButton size="md" title="Close camera viewer" onClick={close}>
              <X className="size-4" aria-hidden />
            </IconButton>
          </header>

          {/* ── The picture ── */}
          <div className="relative aspect-video overflow-hidden rounded-lg border border-line bg-inset">
            {failed ? (
              <div className="absolute inset-0 grid place-items-center px-6 text-center">
                <div>
                  <p className="text-xs font-semibold text-fg">No picture available</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
                    {isUsingCameraFixture()
                      ? 'This deployment has no camera proxy, so frames cannot be fetched. The camera itself may be fine.'
                      : 'The camera may be out of service, or its provider may be refusing our request.'}
                  </p>
                  {providerUrl && (
                    <a
                      href={providerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[11px] text-fg hover:bg-inset"
                    >
                      <ExternalLink className="size-3" aria-hidden />
                      Open at the provider
                    </a>
                  )}
                </div>
              </div>
            ) : mode === 'external' ? (
              <div className="absolute inset-0 grid place-items-center px-6 text-center">
                <div>
                  <p className="text-xs font-semibold text-fg">Provider-hosted feed</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
                    {camera.source} publishes this camera only through its own viewer, so there is no frame to show
                    here.
                  </p>
                  {providerUrl && (
                    <a
                      href={providerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-line bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-fg"
                    >
                      <ExternalLink className="size-3" aria-hidden />
                      Open the live feed
                    </a>
                  )}
                </div>
              </div>
            ) : camera.stream_type === 'iframe' ? (
              armed && embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={`${camera.name} live stream`}
                  className="block size-full border-0"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  onLoad={onFrame}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center px-6 text-center">
                  <div>
                    <p className="text-xs font-semibold text-fg">Provider player</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
                      This camera streams through {camera.source}. Playback runs a full video decode, so it starts when
                      you ask it to.
                    </p>
                    <button
                      type="button"
                      onClick={() => setArmed(true)}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-fg"
                    >
                      <Play className="size-3" aria-hidden />
                      Start the stream
                    </button>
                  </div>
                </div>
              )
            ) : camera.stream_type === 'hls' ? (
              <HlsView camera={camera} onFrame={onFrame} onError={onError} />
            ) : (
              <SnapshotView camera={camera} manualToken={manualToken} onFrame={onFrame} onError={onError} />
            )}

            {/* Overlaid rather than replacing the picture, so a refresh does not blink. */}
            {status === 'connecting' && mode !== 'external' && !armed && camera.stream_type !== 'iframe' && (
              <div className="absolute inset-0 grid place-items-center bg-inset/80">
                <span className="label-micro text-fg-muted">CONNECTING…</span>
              </div>
            )}
          </div>

          {/* ── How current the picture is ── */}
          <section className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wider ${style.tone}`}
            >
              <span aria-hidden className={`size-1.5 rounded-full ${style.dot}`} />
              {mode === 'external' ? 'AT PROVIDER' : style.label}
            </span>

            {mode === 'snapshot' && (
              <>
                <span className="text-[11px] text-fg-muted">
                  Stills every <span className="numeric font-semibold text-fg">{cadence}s</span>
                </span>
                <span className="text-[11px] text-fg-muted">
                  {ageSeconds === null ? 'awaiting first frame' : `updated ${formatAge(ageSeconds)}`}
                </span>
                {nextRefresh !== null && (
                  <span className="numeric text-[11px] text-fg-subtle">next in {nextRefresh}s</span>
                )}
              </>
            )}

            {mode === 'video' && <span className="text-[11px] text-fg-muted">Continuous stream</span>}
          </section>

          {status === 'stale' && (
            <p className="rounded-md border border-status-inferred/30 bg-status-inferred/10 px-2.5 py-2 text-[11px] text-fg">
              This picture has not changed in over {Math.max(30, cadence * 3)} seconds, which is longer than this
              camera&rsquo;s own refresh interval. It is showing the last frame received, not the current view.
            </p>
          )}

          {/* ── Provenance ── */}
          <section className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>SOURCE</FieldLabel>
              <p className="text-xs font-semibold text-fg">{camera.source}</p>
              <p className="mt-1 text-[11px] text-fg-muted">
                {mode === 'video' ? 'Live video' : mode === 'snapshot' ? 'Still images' : 'Provider viewer'}
              </p>
            </div>

            <div>
              <FieldLabel>POSITION</FieldLabel>
              <button
                type="button"
                onClick={() => flyTo(camera.lat, camera.lng, { zoom: 14 })}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg hover:underline"
              >
                <MapPin className="size-3 text-fg-subtle" aria-hidden />
                Show on the map
              </button>
              <p className="numeric mt-1 text-[11px] text-fg-muted">
                {camera.lat.toFixed(4)}, {camera.lng.toFixed(4)}
              </p>
            </div>
          </section>

          {/*
            As published by the operator — never our own measurement. A camera's
            stated position is sometimes the gantry and sometimes the junction it
            watches, and we have no way to tell which.
          */}
          <p className="border-t border-line pt-3 text-[10px] leading-relaxed text-fg-subtle">
            Position and description are as published by {camera.source}. This is an open feed republished as context;
            nothing here is collected by this system.
          </p>

          <div className="flex flex-wrap gap-2">
            {camera.stream_type === 'jpg' && (
              <button
                type="button"
                onClick={() => setManualToken((current) => current + 1)}
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[11px] text-fg hover:bg-inset"
              >
                <RefreshCw className="size-3" aria-hidden />
                Refresh now
              </button>
            )}
            {providerUrl && (
              <a
                href={providerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[11px] text-fg hover:bg-inset"
              >
                <ExternalLink className="size-3" aria-hidden />
                Provider page
              </a>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

/* ── The route ───────────────────────────────────────────────────────────── */

export default function CameraDetailPage() {
  const { cameraId } = useParams<{ cameraId: string }>()
  const navigate = useNavigate()

  const byId = useAppSelector(selectCamerasById)
  const registryStatus = useAppSelector(selectCameraStatus)

  const camera = cameraId ? byId[cameraId] : undefined

  const close = useCallback(() => void navigate('/'), [navigate])
  useEscapeKey(close)

  if (!cameraId) return <Navigate to="/" replace />

  /*
   * A cold deep link has to wait for the registry.
   *
   * Cameras are fetched for the current viewport, so on a fresh load this one is not
   * in the store yet: `useMapUrlState` restores the camera position from the same URL
   * and `useCameraRegistry` then fetches for it. Redirecting before that settles would
   * make every shared `/camera/:id` link useless — the bug `/target` still has.
   *
   * `error` counts as settled. If the registry could not be reached at all, waiting
   * longer will not produce this camera, and holding a blank overlay open is worse
   * than returning to the map.
   */
  if (!camera) return registryStatus === 'ready' || registryStatus === 'error' ? <Navigate to="/" replace /> : null

  // Keyed, so moving between cameras remounts rather than reusing frame state that
  // belongs to the previous one. See the note on `CameraViewer`.
  return <CameraViewer key={camera.id} camera={camera} close={close} />
}
