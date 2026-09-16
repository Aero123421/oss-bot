import { useCallback, useRef, useSyncExternalStore } from 'react'
import { chatStore } from '../store/chatStore'
import { MOCK_DEMO_REPLY, runMockStream } from '../lib/mockStream'
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
 * Streaming controller for the selected chat.
 * P0: mockStream. Swap the body of `startStream` for real WS `/ws?chatId=` later.
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

  const startStream = useCallback(async (chatId: string, assistantId: string, userText: string) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    inflightAssistantId.current = assistantId

    try {
      await runMockStream({
        chatId,
        messageId: assistantId,
        reply: buildMockReply(userText),
        signal: ac.signal,
        onEvent: (ev) => chatStore.applyStreamEvent(ev),
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        chatStore.markAborted(chatId, assistantId)
        return
      }
      chatStore.applyStreamEvent({
        type: 'error',
        chatId,
        messageId: assistantId,
        code: 'stream_failed',
        message: e instanceof Error ? e.message : 'Stream failed',
        retryable: true,
      })
    } finally {
      if (abortRef.current === ac) abortRef.current = null
      inflightAssistantId.current = null
    }
  }, [])

  const send = useCallback(
    async (payload: SendPayload | string) => {
      const s = chatStore.getState()
      if (s.status === 'connecting' || s.status === 'streaming') return
      const chatId = s.selectedChatId
      if (!chatId) {
        chatStore.setError({
          code: 'no_chat',
          message: 'チャットが選択されていません',
          retryable: false,
        })
        return
      }
      const text = typeof payload === 'string' ? payload.trim() : payload.text.trim()
      if (!text) return

      const userId = newId('usr')
      const assistantId = newId('asst')
      chatStore.beginUserTurn(chatId, text, userId, assistantId)
      await startStream(chatId, assistantId, text)
    },
    [startStream],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const retry = useCallback(async () => {
    const s = chatStore.getState()
    if (!s.error?.retryable || !s.lastUserText) return
    await send(s.lastUserText)
  }, [send])

  return { status, error, send, stop, retry }
}

function buildMockReply(userText: string): string {
  return `${MOCK_DEMO_REPLY}\n\n> ${userText.slice(0, 120)}`
}
