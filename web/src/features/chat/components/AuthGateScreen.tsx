import { persistToken, readToken } from '../lib/wsClient'
import { chatStore } from '../store/chatStore'
import { useState } from 'react'

export function AuthGateScreen() {
  const [token, setToken] = useState(readToken())

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <h1>ワークスペースに入るにはセットアップが必要です</h1>
        <p>
          共有トークン（AuthGate）が未設定です。ホストの <code>.env</code> の{" "}
          <code>OSS_BOT_TOKEN</code> を使い、ここでは状態だけ渡します。秘密をリポやUI永続の本線にしません。
        </p>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="OSS_BOT_TOKEN"
          autoComplete="off"
        />
        <div className="row">
          <button
            className="primary"
            type="button"
            onClick={() => {
              const t = token.trim()
              if (!t) return
              persistToken(t)
              chatStore.setAuthGate('ok')
            }}
          >
            入る
          </button>
          <button type="button" onClick={() => window.open('/docs', '_blank')}>
            ドキュメント
          </button>
        </div>
        <p style={{ marginTop: 16, fontSize: 12 }}>
          推奨はホストで <code>./doctor</code> → CredGrant → Ready です。鍵の散在コピーは禁止です。
        </p>
      </div>
    </div>
  )
}
