import { useCallback, useRef, useSyncExternalStore } from 'react'
import { chatStore } from '../store/chatStore'
import { apiFetch, type ApiError } from '../lib/api'
import { subscribeThreadSse, type CpStreamEvent } from '../lib/sse'
import type { ChatError, ChatStatus, SendPayload } from '../types'

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

function applyCpEvent(ev: CpStreamEvent, assistantId: string) {
  const chatId = ev.threadId
  switch (ev.type) {
    case 'status': {
      const status =
        ev.status === 'streaming' || ev.status === 'starting'
          ? 'streaming'
          : ev.status === 'subscribed'
            ? 'connecting'
            : ev.status === 'idle'
              ? 'idle'
              : 'streaming'
      chatStore.applyStreamEvent({ type: 'status', chatId, status })
      break
    }
    case 'token':
      chatStore.applyStreamEvent({
        type: 'token',
        chatId,
        messageId: assistantId,
        text: ev.text,
      })
      break
    case 'message':
      chatStore.applyStreamEvent({
        type: 'token',
        chatId,
        messageId: assistantId,
        text: '',
      })
      chatStore.patchMessage(chatId, assistantId, {
        content: ev.content,
        status: 'complete',
      })
      break
    case 'error':
      chatStore.applyStreamEvent({
        type: 'error',
        chatId,
        messageId: assistantId,
        code: 'cp_stream_error',
        message: ev.error,
        retryable: true,
      })
      break
    case 'done':
      chatStore.applyStreamEvent({
        type: 'done',
        chatId,
        messageId: assistantId,
      })
      break
  }
}

/**
 * Dispatcher + real SSE.
 * POST /api/v1/dispatcher/messages
 * GET  /api/v1/threads/:id/events  (not /ws)
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

  const unsubRef = useRef<(() => void) | null>(null)
  const inflightAssistantId = useRef<string | null>(null)

  const stop = useCallback(() => {
    unsubRef.current?.()
    unsubRef.current = null
    const s = chatStore.getState()
    if (inflightAssistantId.current && s.selectedSessionId) {
      chatStore.markAborted(s.selectedSessionId, inflightAssistantId.current)
    }
    inflightAssistantId.current = null
    chatStore.setWsState('closed')
  }, [])

  const startStream = useCallback(async (sessionId: string, assistantId: string, userText: string) => {
    unsubRef.current?.()
    inflightAssistantId.current = assistantId

    chatStore.setWsState('connecting')
    chatStore.applyStreamEvent({ type: 'status', chatId: sessionId, status: 'connecting' })

    const s = chatStore.getState()
    const botId = s.activeBotId

    unsubRef.current = subscribeThreadSse(
      sessionId,
      (ev) => applyCpEvent(ev, assistantId),
      (message) => {
        chatStore.setWsState('error')
        chatStore.applyStreamEvent({
          type: 'error',
          chatId: sessionId,
          messageId: assistantId,
          code: 'sse_error',
          message,
          retryable: true,
        })
      },
    )

    try {
      chatStore.setWsState('open')
      await apiFetch<{ threadId: string; messageId: string }>('/api/v1/dispatcher/messages', {
        method: 'POST',
        body: JSON.stringify({
          content: userText,
          threadId: sessionId,
          botId: botId || undefined,
          run: true,
        }),
      })
    } catch (e) {
      unsubRef.current?.()
      unsubRef.current = null
      const apiErr = e as Error & ApiError
      const body = apiErr.body as {
        error?: string
        cred?: { hint?: string }
      } | null
      const notReady = apiErr.status === 503 || body?.error === 'not_ready'
      chatStore.setWsState('error')
      chatStore.applyStreamEvent({
        type: 'error',
        chatId: sessionId,
        messageId: assistantId,
        code: notReady ? 'cred_not_ready' : `api_${apiErr.status ?? 'err'}`,
        message: notReady
          ? body?.cred?.hint ||
            'Bot NotReady: host Claude login / CredBridge. npm run doctor'
          : apiErr.message || 'Dispatcher send failed',
        retryable: !notReady,
      })
      inflightAssistantId.current = null
    }
  }, [])

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
