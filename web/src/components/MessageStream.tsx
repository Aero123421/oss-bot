import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  const streamRef = useRef<HTMLDivElement>(null)
  const lastSession = useRef<string | null>(null)
  const nearBottom = useRef(true)
  const lastUserRef = useRef<string | undefined>(undefined)
  const [awayFromLatest, setAwayFromLatest] = useState(false)
  const [finishedSession, setFinishedSession] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [failedSession, setFailedSession] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return
    const controller = new AbortController()
    setFailedSession(null)
    setFinishedSession(null)
    void apiFetch<{ messages: SavedMessage[] }>(
      `/api/v1/threads/${encodeURIComponent(sessionId)}/messages`,
      { signal: controller.signal },
    ).then(({ messages: rows }) => {
      if (controller.signal.aborted) return
      setFinishedSession(sessionId)
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

  useLayoutEffect(() => {
    const stream = streamRef.current
    if (!stream) return
    const changed = lastSession.current !== sessionId
    let lastUser: string | undefined
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'user') {
        lastUser = messages[i].id
        break
      }
    }
    const sentHere = lastUser !== lastUserRef.current && status === 'connecting'
    lastSession.current = sessionId
    lastUserRef.current = lastUser
    if (changed || nearBottom.current || sentHere) {
      stream.scrollTop = stream.scrollHeight
      nearBottom.current = true
      setAwayFromLatest(false)
    }
  }, [messages, sessionId, status])

  const toLatest = () => {
    const stream = streamRef.current
    if (stream) stream.scrollTop = stream.scrollHeight
    nearBottom.current = true
    setAwayFromLatest(false)
  }
  const loading = Boolean(sessionId && sessionId !== finishedSession && sessionId !== failedSession)
  let previousDay = ''

  return (
    <div className="stream-frame">
      <div
        className="stream"
        ref={streamRef}
        onScroll={(event) => {
          const { scrollHeight, scrollTop, clientHeight } = event.currentTarget
          nearBottom.current = scrollHeight - scrollTop - clientHeight < 80
          setAwayFromLatest(!nearBottom.current)
        }}
      >
        <div className="stream-inner" role="log" aria-label="会話履歴" aria-live="polite" aria-busy={loading}>
        {!messages.length && !error && (!sessionId || failedSession !== sessionId) && (
          <div className="stream-empty" role="status">
            <p>{loading ? '履歴を読み込んでいます…' : 'まだメッセージはありません'}</p>
            {!loading && sessionId && <span>下の入力欄から会話を始められます。</span>}
          </div>
        )}
        {messages.map((m) => {
          const approval = m.approvalId ? approvals.find((a) => a.id === m.approvalId) : undefined
          const author = m.role === 'user' ? 'あなた' : m.botRoleLabel ?? (m.role === 'system' ? 'システム' : 'Bot')
          const date = new Date(m.createdAt)
          const validDate = Number.isFinite(date.getTime())
          const day = validDate ? date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }) : ''
          const showDay = day !== previousDay && Boolean(day)
          previousDay = day
          return (
            <Fragment key={m.id}>
              {showDay && <div className="stream-date">{day}</div>}
              <article className={`msg msg-${m.role} ${m.status === 'streaming' ? 'streaming' : ''}`}>
                {m.role === 'assistant' && <span className="msg-avatar" aria-hidden="true">{author.slice(0, 1)}</span>}
                <div className="msg-content">
                  <div className="msg-meta">
                    <span className="msg-role">{author}</span>
                    {validDate && <time className="msg-time" dateTime={date.toISOString()}>{date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</time>}
                  </div>
                  <div className="msg-body">{m.content}{m.status === 'streaming' && <span className="cursor" aria-hidden="true" />}</div>
                  {m.toolCalls?.length ? <details className="msg-tools"><summary>実行の詳細 ({m.toolCalls.length})</summary><ul>{m.toolCalls.map((t) => <li key={t.id}>{t.name} <span>{t.status}</span></li>)}</ul></details> : null}
                  {approval && <ApprovalCardView card={approval} />}
                </div>
              </article>
            </Fragment>
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
          <details className="stream-error-code"><summary>技術情報</summary>{error.code}</details>
        </div>
      )}

        </div>
      </div>
      {awayFromLatest && <button type="button" className="stream-latest" onClick={toLatest}>最新へ <span aria-hidden="true">↓</span></button>}
    </div>
  )
}
