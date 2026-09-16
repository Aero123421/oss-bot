import { chatStore, selectDms, selectGroups } from '../features/chat'
import { useChatStore } from '../features/chat/hooks/useChatStore'
import { CredBadge } from './CredBadge'
import { UnreadBadge } from './UnreadBadge'
import './Sidebar.css'

type Props = {
  onCreateBot: () => void
  onEditBot: (botId: string) => void
}

export function Sidebar({ onCreateBot, onEditBot }: Props) {
  const open = useChatStore((s) => s.sidebarOpen)
  const selectedRoomId = useChatStore((s) => s.selectedRoomId)
  const needActions = useChatStore((s) => s.needActions)
  const bots = useChatStore((s) => s.bots)
  const groups = useChatStore(() => selectGroups())
  const dms = useChatStore(() => selectDms())

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="sidebar">
      <div className="sb-head">
        <div className="sb-ws">Workspace</div>
        <div className="sb-title">oss-bot</div>
      </div>

      <div className="sb-scroll">
        <section className="sb-section" aria-label="rooms">
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

        <section className="sb-section" aria-label="dms">
          <div className="sb-section-label">
            DM
            <button type="button" className="sb-add-bot" onClick={onCreateBot}>
              + Bot
            </button>
          </div>
          {dms.map((r) => {
            const bot = bots.find((b) => b.id === r.botId)
            const cred = r.credStatus ?? bot?.credStatus
            return (
              <div key={r.id} className={`sb-row-wrap ${selectedRoomId === r.id ? 'active' : ''}`}>
                <button
                  type="button"
                  className={`sb-row ${selectedRoomId === r.id ? 'active' : ''}`}
                  onClick={() => chatStore.selectRoom(r.id)}
                >
                  <div className="sb-row-main">
                    <div className="sb-row-name">
                      {r.pinned && <span className="sb-pin" title="Dispatcher">★</span>}
                      {r.name}
                      {r.subtitle && <span className="sb-row-sub">（{r.subtitle}）</span>}
                    </div>
                    {bot?.provider ? (
                      <div className="sb-row-sub">{bot.provider}</div>
                    ) : null}
                  </div>
                  <CredBadge status={cred} />
                  <UnreadBadge kind={r.unread} />
                </button>
                {bot ? (
                  <button
                    type="button"
                    className="sb-edit"
                    title="編集"
                    onClick={() => onEditBot(bot.id)}
                  >
                    編集
                  </button>
                ) : null}
              </div>
            )
          })}
        </section>

        <section className="sb-section" aria-label="needs attention">
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

      <footer className="sb-foot">設定ツリーなし</footer>
    </aside>
  )
}
