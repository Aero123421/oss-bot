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
  const cred = useChatStore(() => chatStore.activeCredStatus())
  const { send, stop, retry } = useChatStream()

  const notReady = cred !== undefined && cred !== 'Ready'
  const canSend = !notReady && draft.trim().length > 0

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
      {notReady && (
        <div className="composer-gate">
          資格情報: {cred} — Ready になるまで送信できません（秘密は表示しません）
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
              ? '未ログイン / 未Ready — Setup 後に入力できます'
              : 'メッセージを入力…  @でBot呼出'
          }
          value={draft}
          onChange={(e) => chatStore.setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={notReady}
          aria-label="メッセージ入力"
        />
        <SendOrStop
          status={status}
          disabled={!canSend}
          onSend={onSend}
          onStop={stop}
        />
      </div>
    </div>
  )
}
