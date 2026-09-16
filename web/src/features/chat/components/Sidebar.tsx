import { useChatStore } from '../hooks/useChatStore'
import { chatStore, credLabel } from '../store/chatStore'

export function Sidebar() {
  const open = useChatStore((s) => s.sidebarOpen)
  const groups = useChatStore((s) => s.groups)
  const bots = useChatStore((s) => s.bots)
  const threads = useChatStore((s) => s.threads)
  const selected = useChatStore((s) => s.selectedSessionId)
  const attention = useChatStore((s) => s.attention)

  const roomThreads = threads.filter((t) => t.kind === 'room')
  const dmThreads = [
    ...threads.filter((t) => t.kind === 'dm' && bots.find((b) => b.id === t.botId)?.isDispatcher),
    ...threads.filter((t) => t.kind === 'dm' && !bots.find((b) => b.id === t.botId)?.isDispatcher),
  ]

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-head">
        <div className="workspace-name">oss-bot</div>
        <div className="workspace-sub">localhost · AI版Slack</div>
      </div>
      <div className="sidebar-scroll">
        <div className="section-label">ルーム</div>
        {roomThreads.map((t) => {
          const g = groups.find((x) => x.id === t.groupId)
          return (
            <button
              key={t.id}
              className={`nav-row${selected === t.id ? ' active' : ''}`}
              onClick={() => chatStore.selectSession(t.id)}
            >
              <span className="name">#{g?.name ?? t.title}</span>
              {g?.unreadKind === 'normal' ? <span className="badge">●</span> : null}
              {g?.unreadKind === 'needs_action' ? <span className="badge warn">◆</span> : null}
            </button>
          )
        })}

        <div className="section-label">DM</div>
        {dmThreads.map((t) => {
          const bot = bots.find((b) => b.id === t.botId)
          return (
            <button
              key={t.id}
              className={`nav-row${selected === t.id ? ' active' : ''}`}
              onClick={() => chatStore.selectSession(t.id)}
            >
              <span className={`dot ${bot?.presence === 'running' ? 'running' : bot?.presence === 'error' ? 'error' : ''}`} />
              <span className="name">
                {bot?.isDispatcher ? <span className="pin">★ </span> : null}
                {bot?.name ?? t.title}
              </span>
              <span className={`badge ${bot?.credStatus === 'ready' ? 'ok' : 'danger'}`}>
                {bot ? credLabel(bot.credStatus) : ''}
              </span>
              {bot?.unreadKind === 'needs_action' ? <span className="badge warn">◆</span> : null}
            </button>
          )
        })}

        <div className="section-label">要対応 ({attention.length})</div>
        {attention.map((a) => (
          <button
            key={a.id}
            className="nav-row"
            onClick={() => chatStore.selectSession(a.threadId)}
          >
            <span className="badge warn">{a.kind === 'approval' ? '◆' : '●'}</span>
            <span className="name">{a.title}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
