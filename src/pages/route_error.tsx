import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

/** Rendered when a route loader or component throws. */
export function RouteError() {
  const error = useRouteError()

  const message = isRouteErrorResponse(error)
    ? `${error.status} — ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred.'

  return (
    <div className="grid h-full place-items-center bg-sea p-8">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="size-6 text-status-inferred" aria-hidden />
        <h1 className="text-base font-bold text-fg">The dashboard hit a problem</h1>
        <p className="text-xs break-words text-fg-muted">{message}</p>
        <a href="/" className="mt-2 rounded-md bg-accent px-4 py-2 text-xs font-bold text-white hover:opacity-90">
          Reload the map
        </a>
      </div>
    </div>
  )
}
