import { useCallback } from 'react'
import { chatStore } from '../features/chat'
import { useChatStream } from '../features/chat/hooks/useChatStream'
import { useChatStore } from '../features/chat/hooks/useChatStore'
import { SendOrStop } from './SendOrStop'
import './Composer.css'

function streamSlotLabel(wsState: string, status: string): string | null {
  if (wsState === 'reconnecting') return '再接続中...'
  if (wsState === 'connecting') return '接続中...'
  if (wsState === 'error') return '切断'
  if (wsState === 'closed' && (status === 'streaming' || status === 'connecting')) {
    return '切断 - 再接続します'
  }
  if (status === 'streaming') return '送信中...'
  if (status === 'connecting') return '接続中...'
  return null
}

export function Composer() {
  const draft = useChatStore((s) => s.draft)
  const status = useChatStore((s) => s.status)
  const wsState = useChatStore((s) => s.wsState)
  const error = useChatStore((s) => s.error)
  const cred = useChatStore(() => chatStore.activeCredStatus())
  const { send, stop, retry } = useChatStream()

  const notReady = cred !== undefined && cred !== 'Ready'
  const canSend = draft.trim().length > 0
  const slot = streamSlotLabel(wsState, status)

  const onSend = useCallback(() => {
    void send(draft)
  }, [draft, send])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend && status !== 'connecting' && status !== 'streaming') onSend()
    }
  }

  return (
    <div className="composer-wrap">
      {slot ? <div className={'composer-stream-slot ' + wsState}>{slot}</div> : null}
      {notReady && (
        <div className="composer-gate">
          資格情報: {cred} - Ready になるまで送信できません（秘密は表示しません）
        </div>
      )}
      {error?.retryable && (
        <div className="composer-retry">
          <span>再試行できます</span>
          <button type="button" onClick={() => void retry()}>
            再試行
          </button>
        </div>
      )}
      <div className="composer">
        <textarea
          rows={1}
          placeholder={
            notReady
              ? '未ログイン / 未Ready - Setup 後に入力できます'
              : 'メッセージを入力...  @でBot呼出'
          }
          value={draft}
          onChange={(e) => chatStore.setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="メッセージ入力"
        />
        <SendOrStop status={status} disabled={!canSend} onSend={onSend} onStop={stop} />
      </div>
    </div>
  )
}
