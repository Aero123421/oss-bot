import type { ChatStatus } from '../features/chat/types'

type Props = {
  status: ChatStatus
  disabled?: boolean
  onSend: () => void
  onStop: () => void
}

export function SendOrStop({ status, disabled, onSend, onStop }: Props) {
  const busy = status === 'connecting' || status === 'streaming'
  if (busy) {
    return (
      <button type="button" className="send-btn stop" onClick={onStop}>
        停止
      </button>
    )
  }
  return (
    <button
      type="button"
      className="send-btn"
      onClick={onSend}
      disabled={disabled}
    >
      送信
    </button>
  )
}
