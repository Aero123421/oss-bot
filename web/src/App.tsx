import { useEffect, useState } from 'react'
import { AuthGateScreen } from './features/chat/components/AuthGateScreen'
import { Sidebar } from './features/chat/components/Sidebar'
import { RoomHeader } from './features/chat/components/RoomHeader'
import { MessageList } from './features/chat/components/MessageList'
import { Composer } from './features/chat/components/Composer'
import { chatStore } from './features/chat/store/chatStore'
import { bootstrapFromCp } from './features/chat/lib/bootstrap'
import { useChatStore } from './features/chat/hooks/useChatStore'

export function App() {
  const [booting, setBooting] = useState(true)
  const authGate = useChatStore((s) => s.authGate)
  const sidebarOpen = useChatStore((s) => s.sidebarOpen)
  const loadError = useChatStore((s) => s.loadError)

  useEffect(() => {
    void bootstrapFromCp()
      .catch((e) =>
        chatStore.setLoadError(e instanceof Error ? e.message : 'bootstrap failed'),
      )
      .finally(() => setBooting(false))
  }, [])

  if (booting) {
    return (
      <div className="auth-gate">
        <div className="auth-card">
          <h1>Connecting...</h1>
          <p>Loading bots / threads / Ready from Control Plane.</p>
        </div>
      </div>
    )
  }

  if (authGate === 'missing_token') {
    return (
      <AuthGateScreen
        onEntered={() => {
          setBooting(true)
          void bootstrapFromCp()
            .catch((e) =>
              chatStore.setLoadError(e instanceof Error ? e.message : 'bootstrap failed'),
            )
            .finally(() => setBooting(false))
        }}
      />
    )
  }

  return (
    <div className="app">
      {sidebarOpen ? (
        <div className="scrim" onClick={() => chatStore.setSidebarOpen(false)} aria-hidden />
      ) : null}
      <Sidebar />
      <main className="main">
        {loadError ? (
          <div className="composer-status error" style={{ padding: 16 }}>
            {loadError}
          </div>
        ) : null}
        <RoomHeader />
        <MessageList />
        <Composer />
      </main>
    </div>
  )
}
