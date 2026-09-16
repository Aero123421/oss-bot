import { useCallback, useEffect, useState } from 'react'
import { AuthGate } from './components/AuthGate'
import { Sidebar } from './components/Sidebar'
import { RoomHeader } from './components/RoomHeader'
import { MessageStream } from './components/MessageStream'
import { Composer } from './components/Composer'
import { BotEditor } from './components/BotEditor'
import { chatStore } from './features/chat'
import { useChatStore } from './features/chat/hooks/useChatStore'
import { hasAuthToken, probeAuthGate } from './features/chat/lib/authGate'
import { apiFetch, clearStoredToken } from './features/chat/lib/api'
import {
  credStatusFromCode,
  providerIdFromPurpose,
  type CredProviderRow,
} from './features/chat/lib/credLabels'
import type { Bot, CredStatus } from './features/chat/types'

type CpBot = {
  id: string
  name: string
  title: string
  role_memo: string
  provider: string
}
type CpThread = {
  id: string
  title: string
  active_bot_id: string | null
  group_id: string | null
}
type CpGroup = { id: string; name: string }

type EditorState =
  | { mode: 'create' }
  | { mode: 'edit'; bot: Bot }
  | null

async function hydrateFromCp() {
  const [botsRes, threadsRes, groupsRes, providersRes] = await Promise.all([
    apiFetch<{ bots: CpBot[] }>('/api/v1/bots'),
    apiFetch<{ threads: CpThread[] }>('/api/v1/threads'),
    apiFetch<{ groups: CpGroup[] }>('/api/v1/groups'),
    apiFetch<{ providers: CredProviderRow[] }>('/api/v1/cred/providers').catch(() => ({
      providers: [] as CredProviderRow[],
    })),
  ])

  const credByProvider = new Map<string, CredStatus>()
  for (const p of providersRes.providers ?? []) {
    const id = providerIdFromPurpose(p.purpose) || p.provider
    credByProvider.set(id, credStatusFromCode(p.status_code))
  }

  const dispatcher =
    botsRes.bots.find((b) => b.id === 'bot_dispatcher' || b.title === '窓口' || b.name === '参謀') ??
    botsRes.bots[0]

  const bots: Bot[] = botsRes.bots.map((b, i) => ({
    id: b.id,
    name: b.name,
    roleLabel: b.title || b.role_memo || b.name,
    provider: b.provider,
    credStatus: credByProvider.get(b.provider) ?? '未ログイン',
    avatarColor: ['#6c8cff', '#3dd68c', '#f5a524', '#e85d75'][i % 4],
  }))

  const roomsFromThreads = threadsRes.threads.map((t) => {
    const isDm = !t.group_id
    const isDispatcher = t.active_bot_id === dispatcher?.id || t.id.includes('dispatcher')
    const bot = bots.find((b) => b.id === t.active_bot_id)
    return {
      id: t.id,
      kind: (isDm ? 'dm' : 'group') as 'dm' | 'group',
      name: t.title || t.id,
      subtitle: isDispatcher ? '窓口' : undefined,
      pinned: Boolean(isDispatcher),
      botId: t.active_bot_id ?? undefined,
      unread: 'none' as const,
      credStatus: isDm ? bot?.credStatus : undefined,
    }
  })

  if (roomsFromThreads.length) {
    chatStore.replaceWorkspace({
      bots,
      rooms: roomsFromThreads,
      selectedRoomId:
        roomsFromThreads.find((r) => r.pinned)?.id ??
        roomsFromThreads.find((r) => r.kind === 'dm')?.id ??
        roomsFromThreads[0]?.id,
      activeBotId: dispatcher?.id ?? bots[0]?.id,
    })
    void groupsRes
  }
}

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hint, setHint] = useState<string | undefined>()
  const [editor, setEditor] = useState<EditorState>(null)
  const sidebarOpen = useChatStore((s) => s.sidebarOpen)
  const bots = useChatStore((s) => s.bots)

  const enter = useCallback(async () => {
    setAuthed(true)
    try {
      await hydrateFromCp()
    } catch {
      /* composer surfaces API errors on send */
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!hasAuthToken()) {
        if (!cancelled) {
          setAuthed(false)
          setChecking(false)
        }
        return
      }
      const probe = await probeAuthGate()
      if (cancelled) return
      if (probe.open) {
        await enter()
      } else {
        if (probe.reason === 'server_closed') clearStoredToken()
        setHint(
          probe.reason === 'unreachable'
            ? 'API unreachable - docker compose up or npm run dev'
            : 'AuthGate closed - set token',
        )
        setAuthed(false)
      }
      setChecking(false)
    })()
    return () => {
      cancelled = true
    }
  }, [enter])

  if (checking) {
    return (
      <div className="auth-gate" role="status">
        <div className="auth-gate-card">
          <p>AuthGate checking...</p>
        </div>
      </div>
    )
  }

  if (!authed) {
    return <AuthGate onEntered={() => void enter()} serverHint={hint} />
  }

  return (
    <div className="app-shell">
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => chatStore.setSidebarOpen(false)}
        aria-hidden
      />
      <Sidebar
        onCreateBot={() => setEditor({ mode: 'create' })}
        onEditBot={(botId) => {
          const bot = bots.find((b) => b.id === botId)
          if (bot) setEditor({ mode: 'edit', bot })
        }}
      />
      <main className="main">
        <RoomHeader />
        <MessageStream />
        <Composer />
      </main>
      {editor?.mode === 'create' ? (
        <BotEditor
          mode="create"
          onClose={() => setEditor(null)}
          onSaved={() => void hydrateFromCp()}
        />
      ) : null}
      {editor?.mode === 'edit' ? (
        <BotEditor
          mode="edit"
          bot={editor.bot}
          onClose={() => setEditor(null)}
          onSaved={() => void hydrateFromCp()}
        />
      ) : null}
    </div>
  )
}
