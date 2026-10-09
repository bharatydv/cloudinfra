/**
 * Google sign-in button, rendered by Google Identity Services.
 *
 * The button itself has to come from Google's own library -- its branding
 * rules do not allow a hand-drawn copy -- so the library is loaded on demand
 * and asked to paint into a container sized to match the form above it.
 *
 * The client ID comes from the API rather than the bundle, so turning Google
 * sign-in on is an environment change on the server and not a frontend
 * rebuild. When it is off, this component renders nothing at all.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { ApiError } from '@/api/client'
import { getAuthProviders } from '@/api/endpoints'
import { useAuth } from '@/hooks/useAuth'
import { queryKeys } from '@/lib/queryClient'
import type { User } from '@/types/api'

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
/** Google refuses a wider button than this. */
const MAX_WIDTH = 400
const MIN_WIDTH = 200

let scriptPromise: Promise<void> | null = null

/** Load the Google library once per page, however many buttons ask for it. */
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()

  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    const script = existing ?? document.createElement('script')
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => {
      // A failed load must not be cached, or a retry can never succeed.
      scriptPromise = null
      reject(new Error('Google sign-in could not be loaded.'))
    })
    if (!existing) {
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  })

  return scriptPromise
}

export function GoogleSignIn({
  text,
  onSuccess,
  onError,
}: {
  /** Which label Google puts on the button. */
  text: 'signin_with' | 'signup_with'
  onSuccess: (user: User) => void
  onError: (message: string) => void
}) {
  const { loginWithGoogle } = useAuth()
  const container = useRef<HTMLDivElement>(null)
  const [isExchanging, setIsExchanging] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  const { data } = useQuery({
    queryKey: queryKeys.authProviders,
    queryFn: getAuthProviders,
    staleTime: 10 * 60_000,
  })
  const clientId = data?.google.enabled ? data.google.client_id : null

  // Kept in a ref so the callback Google holds always sees the current props
  // without having to re-initialise the library.
  const handlers = useRef({ loginWithGoogle, onSuccess, onError })
  handlers.current = { loginWithGoogle, onSuccess, onError }

  const handleCredential = useCallback(async (credential: string) => {
    setIsExchanging(true)
    try {
      const user = await handlers.current.loginWithGoogle(credential)
      handlers.current.onSuccess(user)
    } catch (error) {
      handlers.current.onError(
        error instanceof ApiError ? error.message : 'Google sign-in failed. Please try again.',
      )
    } finally {
      setIsExchanging(false)
    }
  }, [])

  useEffect(() => {
    if (!clientId) return
    let cancelled = false

    async function render() {
      try {
        await loadGoogleScript()
      } catch {
        if (!cancelled) setLoadFailed(true)
        return
      }

      const parent = container.current
      const google = window.google
      if (cancelled || !parent || !google || !clientId) return

      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => void handleCredential(response.credential),
        // One Tap is not used here: the button is the whole point of the page.
        cancel_on_tap_outside: true,
        itp_support: true,
      })

      // Google sizes the button in pixels, so it is matched to the form width
      // rather than left at its default.
      const width = Math.round(parent.clientWidth) || MAX_WIDTH
      parent.replaceChildren()
      google.accounts.id.renderButton(parent, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        logo_alignment: 'center',
        text,
        width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width)),
      })
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [clientId, handleCredential, text])

  if (!clientId) return null

  return (
    <div className="mb-5 space-y-5">
      {loadFailed ? (
        <p className="text-center text-sm text-ink-600">
          Google sign-in is unavailable right now. Please use your email and password.
        </p>
      ) : (
        <div className="relative">
          {/* The container has to stay mounted and untouched by React: Google
              paints an iframe into it. */}
          <div ref={container} className="flex justify-center [color-scheme:light]" />
          {isExchanging && (
            <div
              role="status"
              className="absolute inset-0 flex items-center justify-center gap-3 bg-white/80 text-sm text-ink-600"
            >
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-ink-300 border-t-brand-600"
                aria-hidden="true"
              />
              Signing you in...
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-ink-200" />
        <span className="text-xs font-medium uppercase tracking-wider text-ink-500">or</span>
        <span className="h-px flex-1 bg-ink-200" />
      </div>
    </div>
  )
}
