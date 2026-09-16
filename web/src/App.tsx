import { useEffect } from 'react'
import { AuthGateScreen } from './features/chat/components/AuthGateScreen'
import { Sidebar } from './features/chat/components/Sidebar'
import { RoomHeader } from './features/chat/components/RoomHeader'
import { MessageList } from './features/chat/components/MessageList'
import { Composer } from './features/chat/components/Composer'
import { chatStore } from './features/chat/store/chatStore'
import {
  SEED_ATTENTION,
  SEED_BOTS,
  SEED_GROUPS,
  SEED_THREADS,
  seedMessages,
} from './features/chat/lib/seed'
import { readToken } from './features/chat/lib/wsClient'
import { useChatStore } from './features/chat/hooks/useChatStore'

function bootstrap() {
  const params = new URLSearchParams(window.location.search)
  const forceAuthOff = params.get('auth') === '0'
  const token = readToken()
  const authGate = forceAuthOff || !token ? 'missing_token' : 'ok'

  chatStore.hydrate({
    authGate,
    bots: SEED_BOTS,
    groups: SEED_GROUPS,
    threads: SEED_THREADS,
    messagesByThreadId: seedMessages(),
    attention: SEED_ATTENTION,
    selectedSessionId: 'thr_dm_dispatcher',
    credReady: true,
  })
}

export function App() {
  useEffect(() => {
    bootstrap()
  }, [])

  const authGate = useChatStore((s) => s.authGate)
  const sidebarOpen = useChatStore((s) => s.sidebarOpen)

  if (authGate === 'missing_token') {
    return <AuthGateScreen />
  }

  return (
    <div className="app">
      {sidebarOpen ? (
        <div
          className="scrim"
          onClick={() => chatStore.setSidebarOpen(false)}
          aria-hidden
        />
      ) : null}
      <Sidebar />
      <main className="main">
        <RoomHeader />
        <MessageList />
        <Composer />
      </main>
    </div>
  )
}
