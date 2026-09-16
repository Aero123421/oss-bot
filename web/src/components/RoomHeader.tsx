import { chatStore } from '../features/chat'
import { useChatStore } from '../features/chat/hooks/useChatStore'
import { CredBadge } from './CredBadge'
import { PresenceDot } from './PresenceDot'
import './RoomHeader.css'

export function RoomHeader() {
  const room = useChatStore((s) => s.rooms.find((r) => r.id === s.selectedRoomId))
  const bots = useChatStore((s) => s.bots)
  const activeBotId = useChatStore((s) => s.activeBotId)

  if (!room) return null

  const members =
    room.kind === 'dm'
      ? bots.filter((b) => b.id === room.botId)
      : bots.filter((b) => room.memberBotIds?.includes(b.id))

  const executing = members.some((b) => b.executing)
  const title =
    room.kind === 'group'
      ? `#${room.name}`
      : `${room.name}${room.subtitle ? `（${room.subtitle}）` : ''}`

  return (
    <header className="room-header">
      <button
        type="button"
        className="menu-btn"
        aria-label="メニュー"
        onClick={() => chatStore.toggleSidebar()}
      >
        ☰
      </button>
      <div className="rh-title-block">
        <h1 className="rh-title">{title}</h1>
        <div className="rh-meta">
          <PresenceDot
            executing={executing}
            label={members.map((m) => m.name).join(' · ') || '在席'}
          />
          <CredBadge status={room.credStatus} />
        </div>
      </div>
      {room.kind === 'group' && members.length > 0 && (
        <div className="rh-bots" role="group" aria-label="応答Bot">
          {members.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`rh-bot ${activeBotId === b.id ? 'active' : ''}`}
              style={{ ['--bot' as string]: b.avatarColor }}
              onClick={() => chatStore.setActiveBot(b.id)}
              title="スレッドは維持したまま応答Botを切替"
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
