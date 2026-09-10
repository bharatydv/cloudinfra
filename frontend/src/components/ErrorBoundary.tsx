import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Top-level error boundary.
 *
 * Renders a plain, friendly failure state. Diagnostic detail goes to the
 * console, never onto the page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Replace with a reporting service (Sentry et al.) when one is configured.
    console.error('Unhandled UI error', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-ink-200 bg-white p-8 text-center shadow-card">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-xl font-bold text-ink-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-600">
            The page ran into an unexpected problem. Reloading usually fixes it.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Reload page
            </button>
            <a
              href="/"
              className="inline-flex h-11 items-center rounded-lg border border-ink-300 px-5 text-sm font-semibold text-ink-800 hover:bg-ink-50"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    )
  }
}
