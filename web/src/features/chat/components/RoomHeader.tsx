import { useEffect, useRef } from 'react'
import { useChatStore } from '../hooks/useChatStore'
import { selectMessages, selectSelectedThread } from '../store/chatStore'

export function RoomHeader() {
  const thread = useChatStore(() => selectSelectedThread())
  const bots = useChatStore((s) => s.bots)
  const open = useChatStore((s) => s.sidebarOpen)

  const active = bots.find((b) => b.id === thread?.activeBotId)
  const running = bots.filter((b) => b.presence === 'running')

  return (
    <header className="topbar">
      <button
        className="menu-btn"
        type="button"
        aria-label="メニュー"
        onClick={() => {
          const { chatStore } = require('../store/chatStore') as typeof import('../store/chatStore')
          chatStore.setSidebarOpen(!open)
        }}
      >
        メニュー
      </button>
      <h1>
        {thread?.kind === 'room' ? `#${thread.title}` : thread?.title ?? '…'}
        {thread?.kind === 'dm' && active?.isDispatcher ? '（窓口）' : ''}
      </h1>
      <div className="presence">
        {running.length === 0 ? (
          <span>在席: 静か</span>
        ) : (
          <span>
            在席:{" "}
            {running.map((b, i) => (
              <span key={b.id}>
                {i ? ' · ' : ''}
                <span className="hot">{b.name}(実行中)</span>
              </span>
            ))}
          </span>
        )}
      </div>
    </header>
  )
}
