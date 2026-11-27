import { chatStore } from '../features/chat'
import { useChatStore } from '../features/chat/hooks/useChatStore'
import { CredBadge } from './CredBadge'
import './RoomHeader.css'

export function RoomHeader() {
  const room = useChatStore((s) => s.rooms.find((r) => r.id === s.selectedRoomId))
  const bots = useChatStore((s) => s.bots)
  const activeBotId = useChatStore((s) => s.activeBotId)
  const sidebarOpen = useChatStore((s) => s.sidebarOpen)
  const members = room?.kind === 'group'
    ? bots.filter((b) => room.memberBotIds?.includes(b.id) || room.botId === b.id)
    : bots.filter((b) => room?.botId === b.id)
  const active = bots.find((b) => b.id === activeBotId)
  const title = room?.name ?? '会話'
  const group = room?.kind === 'group'

  return (
    <header className="room-header">
      <button
        id="workspace-menu"
        type="button"
        className="menu-btn"
        aria-label="会話一覧"
        aria-controls="workspace-sidebar"
        aria-expanded={sidebarOpen}
        onClick={() => chatStore.toggleSidebar()}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg>
      </button>
      <span className="rh-glyph" aria-hidden="true">{group ? '#' : title.slice(0, 1)}</span>
      <div className="rh-title-block">
        <h1 className="rh-title" tabIndex={-1}>{title}</h1>
        <div className="rh-meta">
          {room ? (group ? 'ルーム' : room.subtitle || 'ダイレクト') : 'ワークスペース'}
          {active && <><span className="rh-separator" aria-hidden="true">·</span><span className="rh-responder">{group ? `応答: ${active.name}` : 'Bot'}</span></>}
          {active?.executing && <><span className="rh-separator" aria-hidden="true">·</span><span className="rh-running">実行中</span></>}
        </div>
      </div>
      {room && (
        <details className="rh-details" key={room.id} onKeyDown={(event) => {
          if (event.key !== 'Escape' || !event.currentTarget.open) return
          event.currentTarget.open = false
          event.currentTarget.querySelector('summary')?.focus()
          event.stopPropagation()
        }}>
          <summary aria-label="会話の詳細">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v1"/></svg>
            <span>詳細</span>
          </summary>
          <div className="rh-details-body">
            <div className="rh-details-title">会話の詳細</div>
            {active ? (
              <dl>
                <div><dt>応答Bot</dt><dd>{active.name}</dd></div>
                <div><dt>プロバイダ</dt><dd>{active.provider}</dd></div>
                <div><dt>接続状態</dt><dd><CredBadge status={active.credStatus ?? room.credStatus} /></dd></div>
              </dl>
            ) : <p>応答Botが選択されていません。</p>}
            {group && members.length > 1 && (
              <div className="rh-bots" role="group" aria-label="応答Botを切り替え">
                {members.map((b) => (
                  <button key={b.id} type="button" className="rh-bot" aria-pressed={activeBotId === b.id} onClick={() => chatStore.setActiveBot(b.id)}>{b.name}</button>
                ))}
              </div>
            )}
          </div>
        </details>
      )}
    </header>
  )
}
