import { useState } from 'react'
import { apiFetch } from '../features/chat/lib/api'
import { BOT_PROVIDERS, isBotProviderId } from '../features/chat/lib/providers'
import type { Bot } from '../features/chat/types'
import './BotEditor.css'

type Props = {
  mode: 'create' | 'edit'
  bot?: Bot
  onClose: () => void
  onSaved: () => void
}

export function BotEditor({ mode, bot, onClose, onSaved }: Props) {
  const [name, setName] = useState(bot?.name ?? '')
  const [title, setTitle] = useState(bot?.roleLabel ?? '')
  const [provider, setProvider] = useState(bot?.provider ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('名前は必須です')
      return
    }
    if (!isBotProviderId(provider)) {
      setError('プロバイダは必須です（一覧から選択）')
      return
    }
    setSaving(true)
    try {
      if (mode === 'create') {
        await apiFetch('/api/v1/bots', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            title: title.trim(),
            role_memo: title.trim(),
            provider,
            runtime: 'local',
          }),
        })
      } else if (bot) {
        await apiFetch('/api/v1/bots/' + encodeURIComponent(bot.id), {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim(),
            title: title.trim(),
            role_memo: title.trim(),
            provider,
          }),
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bot-editor-overlay" role="dialog" aria-modal="true" aria-label="Bot editor">
      <form className="bot-editor" onSubmit={(e) => void submit(e)}>
        <header className="bot-editor-head">
          <h2>{mode === 'create' ? 'Botを作成' : 'Botを編集'}</h2>
          <button type="button" className="bot-editor-close" onClick={onClose} aria-label="close">
            x
          </button>
        </header>
        <label className="bot-field">
          <span>名前</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <label className="bot-field">
          <span>役割</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="窓口 / 実装" />
        </label>
        <label className="bot-field">
          <span>プロバイダ（必須）</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            required
            aria-required="true"
          >
            <option value="" disabled>
              選択してください
            </option>
            {BOT_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <p className="bot-hint">BYO CLI。枠だけの stub は不可。Cred はラベルのみ表示します。</p>
        {error ? <p className="bot-error">{error}</p> : null}
        <footer className="bot-editor-actions">
          <button type="button" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" disabled={saving || !provider}>
            {saving ? '保存中...' : '保存'}
          </button>
        </footer>
      </form>
    </div>
  )
}
