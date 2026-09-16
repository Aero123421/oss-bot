import { useCallback, useEffect, useState } from 'react'
import { AuthGate } from './components/AuthGate'
import { Sidebar } from './components/Sidebar'
import { RoomHeader } from './components/RoomHeader'
import { MessageStream } from './components/MessageStream'
import { Composer } from './components/Composer'
import { chatStore } from './features/chat'
import { useChatStore } from './features/chat/hooks/useChatStore'
import { hasAuthToken, probeAuthGate } from './features/chat/lib/authGate'
import { apiFetch, clearStoredToken } from './features/chat/lib/api'

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

async function hydrateFromCp() {
  const [botsRes, threadsRes, groupsRes, credRes] = await Promise.all([
    apiFetch<{ bots: CpBot[] }>('/api/v1/bots'),
    apiFetch<{ threads: CpThread[] }>('/api/v1/threads'),
    apiFetch<{ groups: CpGroup[] }>('/api/v1/groups'),
    apiFetch<{ status: { status_code: string } }>('/api/v1/cred/status?purpose=provider:claude').catch(
      () => ({ status: { status_code: 'missing' } }),
    ),
  ])

  const credReady = credRes.status?.status_code === 'ready'
  const credLabel = credReady ? 'Ready' : '未ログイン'

  // Map CP → store via public chatStore helpers if present; else patch seed rooms
  const dispatcher =
    botsRes.bots.find((b) => b.id === 'bot_dispatcher' || b.title === '窓口' || b.name === '参謀') ??
    botsRes.bots[0]
  const roomsFromThreads = threadsRes.threads.map((t) => {
    const isDm = !t.group_id
    const isDispatcher = t.active_bot_id === dispatcher?.id || t.id.includes('dispatcher')
    return {
      id: t.id,
      kind: (isDm ? 'dm' : 'group') as 'dm' | 'group',
      name: t.title || t.id,
      subtitle: isDispatcher ? '窓口' : undefined,
      pinned: Boolean(isDispatcher),
      botId: t.active_bot_id ?? undefined,
      unread: 'none' as const,
      credStatus: (isDm ? credLabel : undefined) as 'Ready' | '未ログイン' | undefined,
    }
  })

  // Prefer CP data: reset rooms if API returned threads
  if (roomsFromThreads.length) {
    const state = chatStore.getState()
    // Keep approvals/needActions from seed for demo cards; replace rooms/bots
    const bots = botsRes.bots.map((b, i) => ({
      id: b.id,
      name: b.name,
      roleLabel: b.title || b.role_memo || b.name,
      credStatus: (credLabel as 'Ready' | '未ログイン'),
      avatarColor: ['#6c8cff', '#3dd68c', '#f5a524', '#e85d75'][i % 4],
    }))
    chatStore.replaceWorkspace({
      bots,
      rooms: roomsFromThreads,
      selectedRoomId:
        roomsFromThreads.find((r) => r.pinned)?.id ??
        roomsFromThreads.find((r) => r.kind === 'dm')?.id ??
        roomsFromThreads[0]?.id,
      activeBotId: dispatcher?.id ?? bots[0]?.id,
    })
    void state
    void groupsRes
  }
}

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hint, setHint] = useState<string | undefined>()
  const sidebarOpen = useChatStore((s) => s.sidebarOpen)

  const enter = useCallback(async () => {
    setAuthed(true)
    try {
      await hydrateFromCp()
    } catch {
      // seed UI still usable; show retry via composer errors on send
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
            ? 'API 未到達 — docker compose up または npm run dev'
            : 'AuthGate closed — トークンを設定してください',
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
          <p>AuthGate を確認しています…</p>
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
      <Sidebar />
      <main className="main">
        <RoomHeader />
        <MessageStream />
        <Composer />
      </main>
    </div>
  )
}
