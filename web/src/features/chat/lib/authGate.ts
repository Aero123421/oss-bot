import { fetchHealthz, getStoredToken } from './api'

/**
 * AuthGate: workspace entry requires configured shared token.
 * Never returns or displays the secret value.
 */
export function hasAuthToken(): boolean {
  if (typeof window === 'undefined') return false
  const q = new URLSearchParams(window.location.search)
  if (q.get('auth') === '0') return false
  return getStoredToken().length > 0
}

export async function probeAuthGate(): Promise<{
  open: boolean
  reason: 'no_local_token' | 'server_closed' | 'ok' | 'unreachable'
}> {
  if (!getStoredToken()) return { open: false, reason: 'no_local_token' }
  try {
    const h = await fetchHealthz()
    if (h.auth_gate === 'closed') return { open: false, reason: 'server_closed' }
    // Confirm token works
    const res = await fetch(`${import.meta.env.VITE_API_BASE ?? ''}/api/v1/me`, {
      headers: { Authorization: `Bearer ${getStoredToken()}` },
    })
    if (res.status === 401) return { open: false, reason: 'server_closed' }
    if (!res.ok) return { open: false, reason: 'unreachable' }
    return { open: true, reason: 'ok' }
  } catch {
    return { open: false, reason: 'unreachable' }
  }
}
