import { useEffect, useRef } from 'react'
import { selectMessagesForSession } from '../features/chat'
import { useChatStore } from '../features/chat/hooks/useChatStore'
import { ApprovalCardView } from './ApprovalCard'
import './MessageStream.css'

export function MessageStream() {
  const sessionId = useChatStore((s) => s.selectedSessionId)
  const messages = useChatStore(() => selectMessagesForSession(sessionId))
  const approvals = useChatStore((s) => s.approvals)
  const status = useChatStore((s) => s.status)
  const error = useChatStore((s) => s.error)
  const bottomRef = useRef<HTMLDivElement>(null)

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
