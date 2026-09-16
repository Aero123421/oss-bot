/** Resolve WebSocket URL from VITE_API_BASE or same-origin. */
export function resolveWsUrl(chatId: string): string {
  const base = import.meta.env.VITE_API_BASE?.replace(/\/$/, '')
  if (base) {
    const u = new URL(base)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    u.pathname = '/ws'
    u.search = `chatId=${encodeURIComponent(chatId)}`
    return u.toString()
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/ws?chatId=${encodeURIComponent(chatId)}`
}

export function resolveApiBase(): string {
  return (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')
}
