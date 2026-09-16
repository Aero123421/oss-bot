import { useChatStore } from '../hooks/useChatStore'
import { chatStore } from '../store/chatStore'
import { useChatStream } from '../hooks/useChatStream'

export function Composer() {
  const draft = useChatStore((s) => s.draft)
  const credReady = useChatStore((s) => s.credReady)
  const authGate = useChatStore((s) => s.authGate)
  const { status, error, send, stop, retry } = useChatStream()
  const busy = status === 'connecting' || status === 'streaming'
  const blocked = authGate !== 'ok' || !credReady

  return (
    <div className="composer-wrap">
      <div className={`composer-status${error ? ' error' : ''}`}>
        {blocked
          ? !credReady
            ? '未Ready — ホストで doctor / auth してから送信できます'
            : 'AuthGate — 共有トークンが必要です'
          : error
            ? `${error.message}${error.retryable ? ' ' : ''}`
            : busy
              ? status === 'connecting'
                ? '接続中…'
                : '応答をストリーム中…'
              : '@でBot呼出 · Enterで送信'}
        {error?.retryable ? (
          <button type="button" style={{ marginLeft: 8 }} onClick={() => void retry()}>
            再試行
          </button>
        ) : null}
      </div>
      <div className="composer">
        <textarea
          value={draft}
          placeholder="メッセージ…"
          rows={2}
          disabled={blocked}
          onChange={(e) => chatStore.setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (!busy && !blocked) void send(draft)
            }
          }}
        />
        {busy ? (
          <button className="stop" type="button" onClick={stop}>
            Stop
          </button>
        ) : (
          <button
            className="send"
            type="button"
            disabled={blocked || !draft.trim()}
            onClick={() => void send(draft)}
          >
            Send
          </button>
        )}
      </div>
    </div>
  )
}
