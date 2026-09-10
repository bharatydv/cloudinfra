/**
 * Thin fetch wrapper.
 *
 * The browser never talks to PostgreSQL: every read and write in the app goes
 * through this client to the FastAPI service.
 */

import { siteConfig } from '@/config/brand'
import type { ApiErrorBody } from '@/types/api'

const ACCESS_TOKEN_KEY = 'lb.access_token'
const REFRESH_TOKEN_KEY = 'lb.refresh_token'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: Record<string, string>

  constructor(status: number, body: ApiErrorBody | null, fallback: string) {
    const message = body?.error?.message ?? fallback
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = body?.error?.code ?? 'unknown_error'
    this.fieldErrors = {}

    const details = body?.error?.details
    if (Array.isArray(details)) {
      for (const item of details) {
        if (
          item &&
          typeof item === 'object' &&
          'field' in item &&
          'message' in item &&
          typeof item.field === 'string' &&
          typeof item.message === 'string'
        ) {
          this.fieldErrors[item.field] = item.message
        }
      }
    }
  }

  get isAuthError(): boolean {
    return this.status === 401
  }
}

/* --- Token storage ------------------------------------------------------- */
export const tokenStore = {
  get access(): string | null {
    try {
      return localStorage.getItem(ACCESS_TOKEN_KEY)
    } catch {
      return null
    }
  },
  get refresh(): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(access: string, refresh: string) {
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, access)
      localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
    } catch {
      /* Private browsing: the session simply will not persist. */
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

type Listener = () => void
const unauthorizedListeners = new Set<Listener>()

export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

/* --- Refresh handling ---------------------------------------------------- */
let refreshPromise: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokenStore.refresh
  if (!refresh) return false

  // Collapse concurrent 401s into a single refresh round trip.
  refreshPromise ??= (async () => {
    try {
      const response = await fetch(`${siteConfig.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      })
      if (!response.ok) return false
      const data = (await response.json()) as { access_token: string; refresh_token: string }
      tokenStore.set(data.access_token, data.refresh_token)
      return true
    } catch {
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/* --- Request ------------------------------------------------------------- */
export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  auth?: boolean
  query?: Record<string, string | number | boolean | undefined | null | string[]>
}

export function buildQuery(
  params: Record<string, string | number | boolean | undefined | null | string[]> = {},
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, String(item)))
    } else {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return response.json()
  return response.text()
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, query, headers, ...rest } = options
  const url = `${siteConfig.apiBaseUrl}${path}${buildQuery(query)}`

  const send = async (): Promise<Response> => {
    const finalHeaders = new Headers(headers)
    if (body !== undefined && !(body instanceof FormData)) {
      finalHeaders.set('Content-Type', 'application/json')
    }
    const token = auth ? tokenStore.access : null
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`)

    return fetch(url, {
      ...rest,
      headers: finalHeaders,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    })
  }

  let response = await send()

  // One transparent retry after refreshing an expired access token.
  if (response.status === 401 && auth && tokenStore.refresh) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      response = await send()
    } else {
      tokenStore.clear()
      unauthorizedListeners.forEach((listener) => listener())
    }
  }

  if (!response.ok) {
    const payload = (await parseBody(response)) as ApiErrorBody | null
    if (response.status === 401 && auth) {
      unauthorizedListeners.forEach((listener) => listener())
    }
    throw new ApiError(
      response.status,
      typeof payload === 'object' ? payload : null,
      'Something went wrong. Please try again.',
    )
  }

  return (await parseBody(response)) as T
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
}
