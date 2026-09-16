import { apiBase, getStoredToken } from './api'

export type CpStreamEvent =
  | { type: 'token'; threadId: string; text: string }
  | { type: 'message'; threadId: string; messageId: string; role: string; content: string }
  | { type: 'status'; threadId: string; status: string; detail?: string }
  | { type: 'error'; threadId: string; error: string }
  | { type: 'done'; threadId: string }

export type SseHandlers = {
  onEvent: (ev: CpStreamEvent) => void
  onError?: (message: string) => void
  onState?: (state: 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error') => void
}

export function subscribeThreadSse(
  threadId: string,
  onEventOrHandlers: ((ev: CpStreamEvent) => void) | SseHandlers,
  onErrorLegacy?: (message: string) => void,
): () => void {
  const handlers: SseHandlers =
    typeof onEventOrHandlers === 'function'
      ? { onEvent: onEventOrHandlers, onError: onErrorLegacy }
      : onEventOrHandlers

  let stopped = false
  let attempt = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let abort: AbortController | null = null

  const scheduleReconnect = () => {
    if (stopped) return
    attempt += 1
    const delay = Math.min(8000, 500 * Math.pow(2, Math.min(attempt, 4)))
    handlers.onState?.('reconnecting')
    timer = setTimeout(connect, delay)
  }

  const connect = () => {
    if (stopped) return
    abort?.abort()
    abort = new AbortController()
    const token = getStoredToken()
    const url = apiBase() + '/api/v1/threads/' + encodeURIComponent(threadId) + '/events'
    handlers.onState?.(attempt === 0 ? 'connecting' : 'reconnecting')

    void (async () => {
      try {
        const res = await fetch(url, {
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
          },
          signal: abort!.signal,
        })
        if (!res.ok || !res.body) {
          handlers.onError?.('SSE HTTP ' + res.status)
          handlers.onState?.('error')
          scheduleReconnect()
          return
        }
        attempt = 0
        handlers.onState?.('open')
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        while (!stopped) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const parts = buf.split('\n\n')
          buf = parts.pop() ?? ''
          for (const part of parts) {
            const dataLine = part.split('\n').find((l) => l.startsWith('data: '))
            if (!dataLine) continue
            try {
              handlers.onEvent(JSON.parse(dataLine.slice(6)) as CpStreamEvent)
            } catch {
              /* ignore */
            }
          }
        }
        if (!stopped) {
          handlers.onState?.('closed')
          scheduleReconnect()
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError' || stopped) return
        handlers.onError?.(e instanceof Error ? e.message : 'SSE failed')
        handlers.onState?.('error')
        scheduleReconnect()
      }
    })()
  }

  connect()

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    abort?.abort()
    handlers.onState?.('closed')
  }
}
