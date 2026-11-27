import { useCallback } from 'react'
import { chatStore } from '../features/chat'
import { useChatStream } from '../features/chat/hooks/useChatStream'
import { useChatStore } from '../features/chat/hooks/useChatStore'
import { SendOrStop } from './SendOrStop'
import './Composer.css'

export function Composer() {
  const draft = useChatStore((s) => s.draft)
  const status = useChatStore((s) => s.status)
  const error = useChatStore((s) => s.error)
  const roomName = useChatStore((s) => s.rooms.find((r) => r.id === s.selectedRoomId)?.name)
  const cred = useChatStore(() => chatStore.activeCredStatus())
  const { send, stop, retry } = useChatStream()
  const notReady = cred !== undefined && cred !== 'Ready'
  const busy = status === 'connecting' || status === 'streaming'
  const canSend = Boolean(roomName && draft.trim())

  const onSend = useCallback(() => {
    void send(draft)
  }, [draft, send])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    if (canSend && !busy) onSend()
  }

  return (
    <div className="composer-wrap">
      <div className="composer-inner">
        {notReady && (
          <div className="composer-gate">このBotは未接続です。送信時に接続状態を確認します。</div>
        )}
        {error?.retryable && (
          <div className="composer-retry">
            <span>前の送信をやり直せます。</span>
            <button type="button" onClick={() => void retry()}>再試行</button>
          </div>
        )}
        <div className="composer">
          <textarea
            rows={2}
            placeholder={roomName ? 'メッセージを書く…' : '会話を選択'}
            value={draft}
            disabled={!roomName}
            onChange={(e) => chatStore.setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="メッセージ入力"
          />
          <div className="composer-actions">
            <span className="composer-target" title={roomName}>{roomName}</span>
            <SendOrStop status={status} disabled={!canSend} onSend={onSend} onStop={stop} />
          </div>
        </div>
      </div>
    </div>
  )
}
