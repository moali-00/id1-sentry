import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last-resort boundary around the whole app.
 *
 * The router has its own `errorElement` for route-level failures; this catches
 * anything thrown above it — provider setup, the store, the map bootstrap.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled error in Sentry Dashboard', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="grid h-full place-items-center bg-sea p-8">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-line bg-surface p-8 text-center">
          <AlertTriangle className="size-6 text-status-missing" aria-hidden />
          <h1 className="text-base font-bold text-fg">Something went wrong</h1>
          <p className="text-xs break-words text-fg-muted">{error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 rounded-md bg-accent px-4 py-2 text-xs font-bold text-accent-fg hover:opacity-90"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
