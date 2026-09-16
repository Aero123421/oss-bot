import { chatStore, selectDms, selectGroups } from '../features/chat'
import { useChatStore } from '../features/chat/hooks/useChatStore'
import { CredBadge } from './CredBadge'
import { UnreadBadge } from './UnreadBadge'
import './Sidebar.css'

export function Sidebar() {
  const open = useChatStore((s) => s.sidebarOpen)
  const selectedRoomId = useChatStore((s) => s.selectedRoomId)
  const needActions = useChatStore((s) => s.needActions)
  const groups = useChatStore(() => selectGroups())
  const dms = useChatStore(() => selectDms())

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="サイドバー">
      <div className="sb-head">
        <div className="sb-ws">Workspace</div>
        <div className="sb-title">oss-bot</div>
      </div>

      <div className="sb-scroll">
        <section className="sb-section" aria-label="ルーム">
          <div className="sb-section-label">ルーム</div>
          {groups.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`sb-row ${selectedRoomId === r.id ? 'active' : ''}`}
              onClick={() => chatStore.selectRoom(r.id)}
            >
              <div className="sb-row-main">
                <div className="sb-row-name">
                  <span className="hash">#</span>
                  {r.name}
                </div>
              </div>
              <UnreadBadge kind={r.unread} />
            </button>
          ))}
        </section>

        <section className="sb-section" aria-label="DM">
          <div className="sb-section-label">DM</div>
          {dms.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`sb-row ${selectedRoomId === r.id ? 'active' : ''}`}
              onClick={() => chatStore.selectRoom(r.id)}
            >
              <div className="sb-row-main">
                <div className="sb-row-name">
                  {r.pinned && <span className="sb-pin" title="Dispatcher窓口">★</span>}
                  {r.name}
                  {r.subtitle && (
                    <span className="sb-row-sub">（{r.subtitle}）</span>
                  )}
                </div>
                {r.unread === 'priority' && (
                  <div className="sb-row-sub">要判断</div>
                )}
              </div>
              <CredBadge status={r.credStatus} />
              <UnreadBadge kind={r.unread} />
            </button>
          ))}
        </section>

        <section className="sb-section" aria-label="要対応">
          <div className="sb-section-label">要対応 ({needActions.length})</div>
          <div className="need-list">
            {needActions.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`need-item ${n.priority === 'P0' ? 'p0' : ''}`}
                onClick={() => chatStore.selectRoom(n.roomId)}
              >
                {n.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <footer className="sb-foot">
        設定ツリーなし ·{' '}
        <a href="?auth=0" title="AuthGate デモ">
          AuthGate デモ
        </a>
      </footer>
    </aside>
  )
}
