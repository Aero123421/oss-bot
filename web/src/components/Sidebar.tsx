import { useEffect, useMemo, useRef } from 'react'
import { chatStore, selectDms, selectGroups } from '../features/chat'
import { useChatStore } from '../features/chat/hooks/useChatStore'
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
  const rooms = useChatStore((s) => s.rooms)
  const groups = useMemo(() => selectGroups(rooms), [rooms])
  const dms = useMemo(() => selectDms(rooms), [rooms])
  const availableActions = useMemo(() => needActions.filter((action) => rooms.some((room) => room.id === action.roomId)), [needActions, rooms])

  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open || !window.matchMedia('(max-width: 760px)').matches) return
    const sidebar = sidebarRef.current
    if (!sidebar) return
    ;(sidebar.querySelector<HTMLButtonElement>('[aria-current="page"]') ?? sidebar.querySelector<HTMLButtonElement>('button'))?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        chatStore.setSidebarOpen(false)
        document.getElementById('workspace-menu')?.focus()
      } else if (event.key === 'Tab') {
        const controls = [...sidebar.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        if (!controls.length) return
        const first = controls[0]
        const last = controls[controls.length - 1]
        const focused = document.activeElement
        if ((!event.shiftKey && focused === last) || (event.shiftKey && focused === first) || !sidebar.contains(focused)) {
          event.preventDefault()
          ;(event.shiftKey ? last : first).focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const select = (roomId: string) => {
    const small = open && window.matchMedia('(max-width: 760px)').matches
    chatStore.selectRoom(roomId)
    if (small) requestAnimationFrame(() => document.querySelector<HTMLElement>('.rh-title')?.focus({ preventScroll: true }))
  }

  const openEditor = (show: () => void) => {
    if (open && window.matchMedia('(max-width: 760px)').matches) chatStore.setSidebarOpen(false)
    show()
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.bot-editor input')?.focus())
  }

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} id="workspace-sidebar" ref={sidebarRef} aria-label="会話一覧">
      <div className="sb-head">
        <span className="sb-mark" aria-hidden="true"><svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M3 12 9 6l6 6-6 6-6-6Zm9 0 3-3 6 6-3 3-6-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg></span>
        <div><div className="sb-title">OSS Bot</div><div className="sb-ws">ワークスペース</div></div>
      </div>

      <nav className="sb-scroll" aria-label="ルームとBot">
        {groups.length > 0 && <section className="sb-section" aria-label="ルーム">
          <div className="sb-section-label">ルーム</div>
          {groups.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`sb-row ${selectedRoomId === r.id ? 'active' : ''}`}
              aria-current={selectedRoomId === r.id ? 'page' : undefined}
              onClick={() => select(r.id)}
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
        </section>}

        <section className="sb-section" aria-label="Bot">
          <div className="sb-section-label">
            Bot
            <button type="button" className="sb-add-bot" onClick={() => openEditor(onCreateBot)} aria-label="Botを追加" title="Botを追加">
              +
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
                  aria-current={selectedRoomId === r.id ? 'page' : undefined}
                  onClick={() => select(r.id)}
                >
                  <span className="sb-avatar" aria-hidden="true">{r.name.slice(0, 1)}</span>
                  <div className="sb-row-main">
                    <div className="sb-row-name">{r.name}</div>
                    {r.subtitle && <div className="sb-row-sub">{r.subtitle}</div>}
                  </div>
                  {cred && cred !== 'Ready' && <span className="sb-connection" aria-label={cred} title={cred}>!</span>}
                  <UnreadBadge kind={r.unread} />
                </button>
                {bot ? (
                  <button
                    type="button"
                    className="sb-edit"
                    title="Botを編集"
                    aria-label={`${bot.name}を編集`}
                    onClick={() => openEditor(() => onEditBot(bot.id))}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m14 6 4 4M5 19l4-.8L20 7l-4-4L5 14.2 5 19Z"/></svg>
                  </button>
                ) : null}
              </div>
            )
          })}
        </section>

        {availableActions.length > 0 && <section className="sb-section" aria-label="要対応">
          <div className="sb-section-label">要対応 ({availableActions.length})</div>
          <div className="need-list">
            {availableActions.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`need-item ${n.priority === 'P0' ? 'p0' : ''}`}
                onClick={() => select(n.roomId)}
              >
                {n.label}
              </button>
            ))}
          </div>
        </section>}
      </nav>
    </aside>
  )
}
