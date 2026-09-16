import { useEffect, useRef } from 'react'
import { useChatStore } from '../hooks/useChatStore'
import { selectMessages } from '../store/chatStore'

export function MessageList() {
  const messages = useChatStore(() => selectMessages())
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="stream" role="log" aria-live="off">
      {messages.map((m) => (
        <div key={m.id} className={`bubble ${m.role}`}>
          {m.role !== 'user' ? (
            <div className="who">{m.authorLabel ?? 'Bot'}</div>
          ) : (
            <div className="who">あなた</div>
          )}
          <div className="body">
            {m.content}
            {m.status === 'streaming' ? <span className="cursor" aria-hidden /> : null}
          </div>
          {m.card && m.card.state === 'pending' ? (
            <div className="card">
              <h3>{m.card.title}</h3>
              <p>{m.card.body}</p>
              <div className="actions">
                <button type="button">許可</button>
                <button type="button">拒否</button>
                <button type="button">後で</button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
