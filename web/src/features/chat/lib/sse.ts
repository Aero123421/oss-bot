import type { StreamEvent } from '../types'

function apiBase(): string {
  return import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ?? ''
}

/** Real SSE via fetch + Authorization — not mock. */
export function subscribeThreadEvents(
  threadId: string,
  token: string,
  onEvent: (ev: StreamEvent) => void,
  onError?: (msg: string) => void,
): () => void {
  const ac = new AbortController()
  const url = `${apiBase()}/api/v1/threads/${encodeURIComponent(threadId)}/events`

  void (async () => {
    try {
      const res = await fetch(url, {
        headers: {
          authorization: `Bearer ${token}`,
          'x-oss-bot-token': token,
          accept: 'text/event-stream',
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
        const chunks = buf.split('\n\n')
        buf = chunks.pop() ?? ''
        for (const chunk of chunks) {
          const line = chunk.split('\n').find((l) => l.startsWith('data: '))
          if (!line) continue
          try {
            onEvent(JSON.parse(line.slice(6)) as StreamEvent)
          } catch {
            /* ignore */
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
