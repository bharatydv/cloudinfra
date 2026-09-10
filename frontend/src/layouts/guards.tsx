import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { InlineSpinner } from '@/components/ui/states'
import { useAuth } from '@/hooks/useAuth'

/**
 * Route guards.
 *
 * These are a usability layer only. Every protected resource is also enforced
 * server-side, so a bypassed guard reveals nothing.
 */
export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <InlineSpinner label="Checking your session" />
  if (!isAuthenticated) {
    // Preserve the destination so login can return the user to it.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}

export function RequireAdmin() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <InlineSpinner label="Checking your session" />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export function RedirectIfAuthenticated() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <InlineSpinner label="Checking your session" />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
