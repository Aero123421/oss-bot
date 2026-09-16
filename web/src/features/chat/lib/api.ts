/** Control Plane HTTP client — UI never calls provider/adapters directly. */

const TOKEN_KEY = 'oss_bot_token'

export function getStoredToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token.trim())
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function apiBase(): string {
  const env = import.meta.env.VITE_API_BASE as string | undefined
  if (env && env.trim()) return env.replace(/\/$/, '')
  return ''
}

export type ApiError = { status: number; body: unknown }

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getStoredToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${apiBase()}${path}`, { ...init, headers })
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    const err = Object.assign(new Error(`api_${res.status}`), {
      status: res.status,
      body,
    }) as Error & ApiError
    throw err
  }
  return body as T
}

export async function fetchHealthz(): Promise<{
  ok: boolean
  auth_gate?: string
}> {
  const res = await fetch(`${apiBase()}/healthz`)
  return (await res.json()) as { ok: boolean; auth_gate?: string }
}
