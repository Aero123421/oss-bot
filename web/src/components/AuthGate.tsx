import { useState } from 'react'
import { setStoredToken } from '../features/chat/lib/api'
import './AuthGate.css'

type Props = {
  onEntered: () => void
  serverHint?: string
}

/** Dedicated empty state when AuthGate closed — not an empty chat home. */
export function AuthGate({ onEntered, serverHint }: Props) {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const t = token.trim()
    if (!t || t.startsWith('change-me')) {
      setErr('非デフォルトの OSS_BOT_TOKEN を入力してください（値は保存後に再表示しません）')
      return
    }
    setBusy(true)
    try {
      setStoredToken(t)
      const res = await fetch('/api/v1/me', {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!res.ok) {
        setErr('トークンが拒否されました。.env の OSS_BOT_TOKEN と一致するか、npm run doctor を確認してください。')
        return
      }
      onEntered()
    } catch {
      setErr('API に到達できません。docker compose up / npm run dev を確認してください。')
    } finally {
      setBusy(false)
      setToken('') // never keep secret in React state after attempt
    }
  }

  return (
    <div className="auth-gate" role="main">
      <div className="auth-gate-card">
        <div className="auth-gate-mark" aria-hidden>
          ◆
        </div>
        <h1>ワークスペースに入るにはセットアップが必要です</h1>
        <p className="auth-gate-lead">
          共有トークン（<code>OSS_BOT_TOKEN</code>）で AuthGate を開きます。会話ホームは表示しません。
          秘密の値はこの画面のログやバッジには出ません。
        </p>
        {serverHint && <p className="auth-gate-note">{serverHint}</p>}
        <form className="auth-gate-actions" onSubmit={submit} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
          <label className="auth-gate-note" htmlFor="oss-token">
            ワークスペーストークン
          </label>
          <input
            id="oss-token"
            type="password"
            autoComplete="off"
            placeholder="OSS_BOT_TOKEN"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #333',
              background: '#111',
              color: '#eee',
            }}
          />
          {err && (
            <p className="auth-gate-note" role="alert" style={{ color: '#f88' }}>
              {err}
            </p>
          )}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? '確認中…' : 'ワークスペースに入る'}
          </button>
          <a className="btn btn-ghost" href="#doctor">
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
        </form>
        <p className="auth-gate-note">
          設定ツリーなし／モデルピッカーなし。修復は doctor に収束します。
        </p>
      </div>
    </div>
  )
}
