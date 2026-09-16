import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { chatStore } from '../store/chatStore'
import { postDispatcherMessage, readToken } from '../lib/api'
import { subscribeThreadEvents } from '../lib/sse'
import type { ChatError, ChatStatus } from '../types'

function newId(prefix: string) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10)
}

export function useChatStream() {
  const status = useSyncExternalStore(
    chatStore.subscribe,
    () => chatStore.getState().status,
    () => 'idle' as ChatStatus,
  )
  const error = useSyncExternalStore(
    chatStore.subscribe,
    () => chatStore.getState().error,
    () => null as ChatError | null,
  )

  const unsubRef = useRef<(() => void) | null>(null)
  useEffect(() => () => unsubRef.current?.(), [])

  const stop = useCallback(() => {
    unsubRef.current?.()
    unsubRef.current = null
    chatStore.markAborted()
  }, [])

  const send = useCallback(async (raw: string) => {
    const s = chatStore.getState()
    if (s.status === 'connecting' || s.status === 'streaming') return
    if (s.authGate !== 'ok') {
      chatStore.setError({ code: 'auth_gate', message: 'AuthGate closed', retryable: false })
      return
    }
    if (!s.credReady) {
      chatStore.setError({
        code: 'cred_not_ready',
        message: 'CredGrant not Ready',
        retryable: false,
      })
      return
    }
    const threadId = s.selectedSessionId
    if (!threadId) return
    const text = raw.trim()
    if (!text) return

    const token = readToken()
    const thread = s.threads.find((t) => t.id === threadId)
    chatStore.beginUserTurn(threadId, text, newId('usr'), newId('asst'))

    unsubRef.current?.()
    unsubRef.current = subscribeThreadEvents(
      threadId,
      token,
      (ev) => chatStore.applyStreamEvent(ev),
      (message) => chatStore.setError({ code: 'sse_error', message, retryable: true }),
    )

    try {
      await postDispatcherMessage(token, {
        content: text,
        threadId,
        botId: thread?.activeBotId ?? undefined,
        groupId: thread?.groupId,
      })
    } catch (e) {
      unsubRef.current?.()
      chatStore.setError({
        code: 'send_failed',
        message: e instanceof Error ? e.message : 'send failed',
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
