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
        受信を停止
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
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>
    </button>
  )
}
