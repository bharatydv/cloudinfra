import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { onUnauthorized, tokenStore } from '@/api/client'
import * as endpoints from '@/api/endpoints'
import { queryClient } from '@/lib/queryClient'
import type { User } from '@/types/api'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isAdmin: boolean
  isStaff: boolean
  /** True until the stored session has been validated against the API. */
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (payload: endpoints.RegisterPayload) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const clearSession = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    queryClient.clear()
  }, [])

  // Restore the session on first load.
  useEffect(() => {
    let cancelled = false

    async function restore() {
      if (!tokenStore.access && !tokenStore.refresh) {
        setIsLoading(false)
        return
      }
      try {
        const me = await endpoints.getMe()
        if (!cancelled) setUser(me)
      } catch {
        if (!cancelled) clearSession()
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [clearSession])

  // A refresh failure anywhere in the app ends the session here.
  useEffect(() => onUnauthorized(() => setUser(null)), [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await endpoints.login({ email, password })
    tokenStore.set(response.tokens.access_token, response.tokens.refresh_token)
    setUser(response.user)
    await queryClient.invalidateQueries()
    return response.user
  }, [])

  const register = useCallback(async (payload: endpoints.RegisterPayload) => {
    const response = await endpoints.register(payload)
    tokenStore.set(response.tokens.access_token, response.tokens.refresh_token)
    setUser(response.user)
    return response.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await endpoints.logout(tokenStore.refresh)
    } catch {
      /* Signing out locally matters more than the server round trip. */
    }
    clearSession()
  }, [clearSession])

  const refreshUser = useCallback(async () => {
    try {
      setUser(await endpoints.getMe())
    } catch {
      clearSession()
    }
  }, [clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin',
      isStaff: user?.role === 'admin' || user?.role === 'instructor',
      isLoading,
      login,
      register,
      logout,
      refreshUser,
      setUser,
    }),
    [user, isLoading, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
