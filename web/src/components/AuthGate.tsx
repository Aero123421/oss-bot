import './AuthGate.css'

type Props = {
  onDemoEnter?: () => void
}

/** Dedicated empty state when shared token is unset — not an empty chat home. */
export function AuthGate({ onDemoEnter }: Props) {
  return (
    <div className="auth-gate" role="main">
      <div className="auth-gate-card">
        <div className="auth-gate-mark" aria-hidden>
          ◆
        </div>
        <h1>ワークスペースに入るにはセットアップが必要です</h1>
        <p className="auth-gate-lead">
          共有トークン（例: <code>OSS_BOT_TOKEN</code>）が未設定です。会話ホームは表示しません。
          秘密の値はこの画面には出ません。
        </p>
        <div className="auth-gate-actions">
          <a className="btn btn-primary" href="#doctor">
            ./doctor を実行
          </a>
          <a
            className="btn btn-ghost"
            href="https://github.com/Aero123421/oss-bot/blob/main/docs/ia-memo-case-b.md"
            target="_blank"
            rel="noreferrer"
          >
            ドキュメント
          </a>
        </div>
        <p className="auth-gate-note">
          設定ツリーなし／モデルピッカーなし。修復は doctor に収束します。
        </p>
        {onDemoEnter && (
          <button type="button" className="auth-gate-demo" onClick={onDemoEnter}>
            デモ UI を表示（auth=1）
          </button>
        )}
      </div>
    </div>
  )
}
