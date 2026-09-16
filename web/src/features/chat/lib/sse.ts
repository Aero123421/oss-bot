import { apiBase, getStoredToken } from './api'

/** CP wire events from GET /api/v1/threads/:id/events */
export type CpStreamEvent =
  | { type: 'token'; threadId: string; text: string }
  | { type: 'message'; threadId: string; messageId: string; role: string; content: string }
  | { type: 'status'; threadId: string; status: string; detail?: string }
  | { type: 'error'; threadId: string; error: string }
  | { type: 'done'; threadId: string }

/**
 * Real SSE (fetch + Bearer). Not WebSocket /ws. Not mock.
 * Endpoint: GET /api/v1/threads/:id/events (alias /stream).
 */
export function subscribeThreadSse(
  threadId: string,
  onEvent: (ev: CpStreamEvent) => void,
  onError?: (message: string) => void,
): () => void {
  const ac = new AbortController()
  const token = getStoredToken()
  const url = `${apiBase()}/api/v1/threads/${encodeURIComponent(threadId)}/events`

  void (async () => {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: ac.signal,
      })
      if (!res.ok || !res.body) {
        onError?.(`SSE HTTP ${res.status}`)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          const dataLine = part.split('\n').find((l) => l.startsWith('data: '))
          if (!dataLine) continue
          try {
            onEvent(JSON.parse(dataLine.slice(6)) as CpStreamEvent)
          } catch {
            /* ignore malformed */
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      onError?.(e instanceof Error ? e.message : 'SSE failed')
    }
  })()

  return () => ac.abort()
}
