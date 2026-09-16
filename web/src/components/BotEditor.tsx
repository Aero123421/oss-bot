import { useEffect, useState } from 'react'
import { apiFetch } from '../features/chat/lib/api'
import {
  credStatusFromCode,
  providerIdFromPurpose,
  type CredProviderRow,
} from '../features/chat/lib/credLabels'
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
  const [providers, setProviders] = useState<CredProviderRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch<{ providers: CredProviderRow[] }>('/api/v1/cred/providers')
        if (cancelled) return
        const list = res.providers ?? []
        setProviders(list)
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'providers load failed')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('name required')
      return
    }
    if (!provider.trim()) {
      setError('provider required')
      return
    }
    const allowed = providers.some((p) => {
      const id = providerIdFromPurpose(p.purpose) || p.provider
      return id === provider
    })
    if (providers.length > 0 && !allowed) {
      setError('provider must be chosen from /cred/providers')
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
      setError(err instanceof Error ? err.message : 'save failed')
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
            disabled={providers.length === 0 && !loadError}
          >
            <option value="" disabled>
              {providers.length ? '選択してください' : '読込中...'}
            </option>
            {providers.map((p) => {
              const id = providerIdFromPurpose(p.purpose) || p.provider
              const label = credStatusFromCode(p.status_code)
              return (
                <option key={id} value={id}>
                  {id} - {label}
                </option>
              )
            })}
          </select>
        </label>
        <p className="bot-hint">GET /api/v1/cred/providers (7). Cred labels only. No stub UI.</p>
        {loadError ? <p className="bot-error">{loadError}</p> : null}
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
