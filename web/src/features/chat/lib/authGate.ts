/**
 * AuthGate: shared token presence only (status, never the secret value).
 * Demo: default OK so reviewers see home UI; `?auth=0` forces empty state.
 */
export function hasAuthToken(): boolean {
  if (typeof window === 'undefined') return true
  const q = new URLSearchParams(window.location.search)
  if (q.get('auth') === '0') return false
  if (q.get('auth') === '1') return true
  if (import.meta.env.VITE_HAS_TOKEN === '0') return false
  // Demo seed: treat as configured so product UI is reviewable
  return true
}
