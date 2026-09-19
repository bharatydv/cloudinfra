import { lazy, type ComponentType } from 'react'

const RELOAD_FLAG = 'lb.chunk-reload'

/**
 * Wraps `lazy(() => import(...))` so a stale chunk (the tab was open across a
 * deploy, so the hashed file it's asking for is gone from the server) reloads
 * the page once instead of surfacing as a blank error screen. A real bug in
 * the chunk still reaches the error boundary on the second attempt.
 */
export function lazyImport<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): ReturnType<typeof lazy<T>> {
  return lazy(async () => {
    try {
      const result = await factory()
      try {
        sessionStorage.removeItem(RELOAD_FLAG)
      } catch {
        /* ignore */
      }
      return result
    } catch (error) {
      let alreadyReloaded = false
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1'
      } catch {
        /* Private browsing: fall through to the error boundary. */
      }

      if (!alreadyReloaded) {
        try {
          sessionStorage.setItem(RELOAD_FLAG, '1')
        } catch {
          /* ignore */
        }
        window.location.reload()
        // Never resolves: the reload is already in flight.
        return new Promise<{ default: T }>(() => {})
      }

      throw error
    }
  })
}
