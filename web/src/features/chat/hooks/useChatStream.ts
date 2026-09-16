import { useCallback, useRef, useSyncExternalStore } from 'react'
import { chatStore } from '../store/chatStore'
import { apiFetch, type ApiError } from '../lib/api'
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

/**
 * Dispatcher path only: POST /api/v1/dispatcher/messages then poll thread messages.
 * UI never talks to provider adapters. Mock is not on this path.
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

  const abortRef = useRef<AbortController | null>(null)
  const inflightAssistantId = useRef<string | null>(null)

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    const s = chatStore.getState()
    if (inflightAssistantId.current && s.selectedSessionId) {
      chatStore.markAborted(s.selectedSessionId, inflightAssistantId.current)
    }
    inflightAssistantId.current = null
    chatStore.setWsState('closed')
  }, [])

  const startStream = useCallback(
    async (sessionId: string, assistantId: string, userText: string) => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      inflightAssistantId.current = assistantId

      chatStore.setWsState('connecting')
      chatStore.applyStreamEvent({
        type: 'status',
        chatId: sessionId,
        status: 'connecting',
      })

      const s = chatStore.getState()
      const botId = s.activeBotId

      try {
        chatStore.applyStreamEvent({
          type: 'status',
          chatId: sessionId,
          status: 'streaming',
        })
        chatStore.setWsState('open')

        const result = await apiFetch<{
          threadId: string
          messageId: string
          runNote?: string
          error?: string
          cred?: { status_code?: string; hint?: string }
        }>('/api/v1/dispatcher/messages', {
          method: 'POST',
          body: JSON.stringify({
            content: userText,
            threadId: sessionId,
            botId: botId || undefined,
            run: true,
          }),
          signal: ac.signal,
        })

        const threadId = result.threadId || sessionId
        // Poll for assistant reply (Claude may be async / NotReady)
        const started = Date.now()
        let lastCount = 0
        while (!ac.signal.aborted && Date.now() - started < 90_000) {
          const data = await apiFetch<{
            messages: Array<{
              id: string
              role: string
              content: string
              bot_id: string | null
              created_at: string
            }>
          }>(`/api/v1/threads/${threadId}/messages`, { signal: ac.signal })

          const msgs = data.messages ?? []
          if (msgs.length > lastCount) {
            for (const m of msgs.slice(lastCount)) {
              if (m.role === 'assistant') {
                chatStore.applyStreamEvent({
                  type: 'token',
                  chatId: threadId,
                  messageId: assistantId,
                  text: m.content,
                })
                chatStore.applyStreamEvent({
                  type: 'done',
                  chatId: threadId,
                  messageId: assistantId,
                })
                inflightAssistantId.current = null
                abortRef.current = null
                chatStore.setWsState('closed')
                return
              }
            }
            lastCount = msgs.length
          }
          await new Promise((r) => setTimeout(r, 400))
        }

        // Timeout / NotReady path — surface doctor card style error
        chatStore.applyStreamEvent({
          type: 'error',
          chatId: sessionId,
          messageId: assistantId,
          code: 'dispatcher_timeout',
          message:
            'Dispatcher 応答待ちがタイムアウトしました。Claude CLI / CredBridge / doctor を確認してください。',
          retryable: true,
        })
      } catch (e) {
        if (ac.signal.aborted) return
        const apiErr = e as Error & ApiError
        const body = apiErr.body as {
          error?: string
          cred?: { status_code?: string; hint?: string }
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
              'Bot NotReady: ホストで Claude ログイン / CredBridge RO mounts。npm run doctor'
            : apiErr.message || 'Dispatcher への送信に失敗しました',
          retryable: !notReady,
        })
      } finally {
        if (abortRef.current === ac) abortRef.current = null
        inflightAssistantId.current = null
      }
    },
    [],
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
