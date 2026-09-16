import { useCallback, useRef, useSyncExternalStore } from 'react'
import { chatStore } from '../store/chatStore'
import { resolveWsUrl } from '../lib/wsUrl'
import type { ChatError, ChatStatus, SendPayload, StreamEvent } from '../types'

export type UseChatStreamResult = {
  status: ChatStatus
  error: ChatError | null
  send: (payload: SendPayload | string) => Promise<void>
  stop: () => void
  retry: () => Promise<void>
}

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

function parseEvent(raw: string): StreamEvent | null {
  try {
    const data = JSON.parse(raw) as StreamEvent
    if (!data || typeof data !== 'object' || !('type' in data)) return null
    return data
  } catch {
    return null
  }
}

/**
 * Real WebSocket controller for `/ws?chatId=`.
 * Mock stream generators are NOT on the main path.
 * Connection failure surfaces as retryable UI error (no empty home).
 */
export function useChatStream(): UseChatStreamResult {
  const status = useSyncExternalStore(
    chatStore.subscribe,
    () => chatStore.getState().status,
    () => chatStore.getState().status,
  )
  const error = useSyncExternalStore(
    chatStore.subscribe,
    () => chatStore.getState().error,
    () => chatStore.getState().error,
  )

  const wsRef = useRef<WebSocket | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inflightAssistantId = useRef<string | null>(null)

  const cleanupSocket = useCallback(() => {
    const ws = wsRef.current
    wsRef.current = null
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    }
    chatStore.setWsState('closed')
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    cleanupSocket()
    const s = chatStore.getState()
    if (inflightAssistantId.current && s.selectedSessionId) {
      chatStore.markAborted(s.selectedSessionId, inflightAssistantId.current)
    }
    inflightAssistantId.current = null
  }, [cleanupSocket])

  const startStream = useCallback(
    async (sessionId: string, assistantId: string, userText: string) => {
      abortRef.current?.abort()
      cleanupSocket()
      const ac = new AbortController()
      abortRef.current = ac
      inflightAssistantId.current = assistantId

      chatStore.setWsState('connecting')
      chatStore.applyStreamEvent({
        type: 'status',
        chatId: sessionId,
        status: 'connecting',
      })

      const url = resolveWsUrl(sessionId)

      await new Promise<void>((resolve) => {
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          resolve()
        }

        let ws: WebSocket
        try {
          ws = new WebSocket(url)
        } catch (e) {
          chatStore.setWsState('error')
          chatStore.applyStreamEvent({
            type: 'error',
            chatId: sessionId,
            messageId: assistantId,
            code: 'ws_construct_failed',
            message:
              e instanceof Error
                ? e.message
                : 'WebSocket を開始できませんでした',
            retryable: true,
          })
          finish()
          return
        }

        wsRef.current = ws

        const onAbort = () => {
          cleanupSocket()
          finish()
        }
        ac.signal.addEventListener('abort', onAbort, { once: true })

        ws.onopen = () => {
          if (ac.signal.aborted) return
          chatStore.setWsState('open')
          chatStore.applyStreamEvent({
            type: 'status',
            chatId: sessionId,
            status: 'streaming',
          })
          ws.send(
            JSON.stringify({
              type: 'user_message',
              chatId: sessionId,
              messageId: assistantId,
              text: userText,
            }),
          )
        }

        ws.onmessage = (ev) => {
          if (ac.signal.aborted) return
          const event = parseEvent(String(ev.data))
          if (!event) return
          // Normalize chatId → session thread
          const normalized = { ...event, chatId: event.chatId || sessionId }
          chatStore.applyStreamEvent(normalized)
          if (normalized.type === 'done' || normalized.type === 'error') {
            cleanupSocket()
            finish()
          }
        }

        ws.onerror = () => {
          if (ac.signal.aborted) return
          chatStore.setWsState('error')
          chatStore.applyStreamEvent({
            type: 'error',
            chatId: sessionId,
            messageId: assistantId,
            code: 'ws_error',
            message:
              'Control Plane の WebSocket に接続できませんでした。API 起動と /ws を確認し、再試行してください。',
            retryable: true,
          })
          cleanupSocket()
          finish()
        }

        ws.onclose = (ev) => {
          if (ac.signal.aborted) return
          const stillStreaming =
            chatStore.getState().status === 'connecting' ||
            chatStore.getState().status === 'streaming'
          if (stillStreaming && !ev.wasClean) {
            chatStore.setWsState('error')
            chatStore.applyStreamEvent({
              type: 'error',
              chatId: sessionId,
              messageId: assistantId,
              code: 'ws_closed',
              message:
                'WebSocket が切断されました。Control Plane が起動しているか確認してください。',
              retryable: true,
            })
          } else {
            chatStore.setWsState('closed')
          }
          finish()
        }
      })

      if (abortRef.current === ac) abortRef.current = null
      inflightAssistantId.current = null
    },
    [cleanupSocket],
  )

  const send = useCallback(
    async (payload: SendPayload | string) => {
      const s = chatStore.getState()
      if (s.status === 'connecting' || s.status === 'streaming') return
      const sessionId = s.selectedSessionId
      if (!sessionId) {
        chatStore.setError({
          code: 'no_session',
          message: 'セッションが選択されていません',
          retryable: false,
        })
        return
      }

      const cred = chatStore.activeCredStatus()
      if (cred && cred !== 'Ready') {
        chatStore.setError({
          code: 'cred_not_ready',
          message:
            cred === '未ログイン'
              ? '未ログインです。Setup / 再認証後に送信できます。'
              : `資格情報状態: ${cred} — 送信できません。`,
          retryable: false,
        })
        return
      }

      const text = typeof payload === 'string' ? payload.trim() : payload.text.trim()
      if (!text) return

      const bot = s.bots.find((b) => b.id === s.activeBotId) ?? null
      const userId = newId('usr')
      const assistantId = newId('asst')
      chatStore.beginUserTurn(sessionId, text, userId, assistantId, bot)
      await startStream(sessionId, assistantId, text)
    },
    [startStream],
  )

  const retry = useCallback(async () => {
    const s = chatStore.getState()
    if (!s.error?.retryable || !s.lastUserText) return
    await send(s.lastUserText)
  }, [send])

  return { status, error, send, stop, retry }
}
