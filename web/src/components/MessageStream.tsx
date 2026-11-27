import { useEffect, useRef, useState } from 'react'
import { chatStore, selectMessagesForSession, type Message } from '../features/chat'
import { apiFetch } from '../features/chat/lib/api'
import { useChatStore } from '../features/chat/hooks/useChatStore'
import { ApprovalCardView } from './ApprovalCard'
import './MessageStream.css'

type SavedMessage = {
  id: string
  role: Message['role']
  content: string
  bot_id: string | null
  created_at: string
}

export function MessageStream() {
  const sessionId = useChatStore((s) => s.selectedSessionId)
  const messages = useChatStore(() => selectMessagesForSession(sessionId))
  const approvals = useChatStore((s) => s.approvals)
  const status = useChatStore((s) => s.status)
  const error = useChatStore((s) => s.error)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [retry, setRetry] = useState(0)
  const [failedSession, setFailedSession] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return
    const controller = new AbortController()
    setFailedSession(null)
    void apiFetch<{ messages: SavedMessage[] }>(
      `/api/v1/threads/${encodeURIComponent(sessionId)}/messages`,
      { signal: controller.signal },
    ).then(({ messages: rows }) => {
      if (controller.signal.aborted) return
      const bots = chatStore.getState().bots
      chatStore.restoreMessages(sessionId, rows.map((row) => ({
        id: row.id,
        sessionId,
        role: row.role,
        content: row.content,
        botId: row.bot_id ?? undefined,
        botRoleLabel: bots.find((bot) => bot.id === row.bot_id)?.name,
        status: 'complete',
        createdAt: Date.parse(row.created_at),
      })))
    }).catch(() => {
      if (!controller.signal.aborted) setFailedSession(sessionId)
    })
    return () => controller.abort()
  }, [sessionId, retry])


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  return (
    <div className="stream" role="log" aria-live="polite">
      {messages.map((m) => {
        const approval = m.approvalId
          ? approvals.find((a) => a.id === m.approvalId)
          : undefined
        return (
          <article
            key={m.id}
            className={`msg msg-${m.role} ${m.status === 'streaming' ? 'streaming' : ''}`}
          >
            <div className="msg-meta">
              <span className="msg-role">
                {m.role === 'user'
                  ? 'あなた'
                  : m.botRoleLabel ?? (m.role === 'system' ? 'system' : 'Bot')}
              </span>
              <time className="msg-time">
                {new Date(m.createdAt).toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
            <div className="msg-body">
              {m.content}
              {m.status === 'streaming' && <span className="cursor" aria-hidden />}
            </div>
            {m.toolCalls?.map((t) => (
              <div key={t.id} className="tool-chip">
                tool · {t.name} · {t.status}
              </div>
            ))}
            {approval && <ApprovalCardView card={approval} />}
          </article>
        )
      })}

      {sessionId && failedSession === sessionId && (
        <div className="stream-error" role="alert">
          履歴を読み込めませんでした。
          <button type="button" onClick={() => setRetry((n) => n + 1)}>履歴を再試行</button>
        </div>
      )}

      {error && (
        <div className="stream-error" role="alert">
          <div className="stream-error-title">接続 / ストリームエラー</div>
          <p>{error.message}</p>
          <p className="stream-error-code">{error.code}</p>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
