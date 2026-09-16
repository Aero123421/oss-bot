import type { UnreadKind } from '../features/chat/types'

export function UnreadBadge({ kind }: { kind: UnreadKind }) {
  if (kind === 'none') return null
  if (kind === 'priority') {
    return (
      <span className="unread unread-priority" title="要判断">
        ◆
      </span>
    )
  }
  return (
    <span className="unread unread-normal" title="未読">
      ●
    </span>
  )
}
