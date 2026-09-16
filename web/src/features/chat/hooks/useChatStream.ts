import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { chatStore } from '../store/chatStore'
import { connectChatWs, postMessage, readToken } from '../lib/wsClient'
import type { ChatError, ChatStatus } from '../types'

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function useChatStream(): {
  status: ChatStatus
  error: ChatError | null
  send: (text: string) => Promise<void>
  stop: () => void
  retry: () => Promise<void>
} {
  const status = useSyncExternalStore(
    chatStore.subscribe,
    () => chatStore.getState().status,
    () => 'idle' as ChatStatus,
  )
  const error = useSyncExternalStore(
    chatStore.subscribe,
    () => chatStore.getState().error,
    () => null,
  )

  const wsRef = useRef<ReturnType<typeof connectChatWs> | null>(null)
  const assistantIdRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      wsRef.current?.close()
    }
  }, [])

  const stop = useCallback(() => {
    const s = chatStore.getState()
    const threadId = s.selectedSessionId
    const asst = assistantIdRef.current
    wsRef.current?.close()
    wsRef.current = null
    if (threadId && asst) chatStore.markAborted(threadId, asst)
    assistantIdRef.current = null
  }, [])

  const send = useCallback(async (raw: string) => {
    const s = chatStore.getState()
    if (s.status === 'connecting' || s.status === 'streaming') return
    if (s.authGate !== 'ok') {
      chatStore.setError({
        code: 'auth_gate',
        message: '共有トークンが未設定です',
        retryable: false,
      })
      return
    }
    if (!s.credReady) {
      chatStore.setError({
        code: 'cred_not_ready',
        message: 'CredGrant が Ready ではありません（ホストで doctor / auth）',
        retryable: false,
      })
      return
    }
    const threadId = s.selectedSessionId
    if (!threadId) return
    const text = raw.trim()
    if (!text) return

    const token = readToken()
    const userId = newId('usr')
    const assistantId = newId('asst')
    assistantIdRef.current = assistantId
    chatStore.beginUserTurn(threadId, text, userId, assistantId)

    wsRef.current?.close()
    wsRef.current = connectChatWs({
      threadId,
      token,
      onOpen: () => {
        chatStore.applyStreamEvent({
          type: 'status',
          chatId: threadId,
          status: 'streaming',
        })
      },
      onEvent: (ev) => {
        const mapped =
          ev.type === 'token' || ev.type === 'done' || ev.type === 'error' || ev.type === 'status'
            ? { ...ev, messageId: 'messageId' in ev && ev.messageId ? ev.messageId : assistantId }
            : ev
        if (mapped.type === 'token' || mapped.type === 'done' || mapped.type === 'error') {
          chatStore.applyStreamEvent({
            ...mapped,
            messageId: assistantId,
            chatId: threadId,
          } as typeof ev)
        } else {
          chatStore.applyStreamEvent({ ...ev, chatId: threadId })
        }
      },
      onError: (message) => {
        chatStore.applyStreamEvent({
          type: 'error',
          chatId: threadId,
          messageId: assistantId,
          code: 'ws_error',
          message,
          retryable: true,
        })
      },
    })

    try {
      await postMessage({ threadId, text, token })
    } catch (e) {
      wsRef.current?.close()
      chatStore.applyStreamEvent({
        type: 'error',
        chatId: threadId,
        messageId: assistantId,
        code: 'send_failed',
        message: e instanceof Error ? e.message : '送信に失敗しました',
        retryable: true,
      })
    }
  }, [])

  const retry = useCallback(async () => {
    const s = chatStore.getState()
    if (!s.error?.retryable || !s.lastUserText) return
    await send(s.lastUserText)
  }, [send])

  return { status, error, send, stop, retry }
}
