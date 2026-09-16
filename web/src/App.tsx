import { useCallback, useState } from 'react'
import { AuthGate } from './components/AuthGate'
import { Sidebar } from './components/Sidebar'
import { RoomHeader } from './components/RoomHeader'
import { MessageStream } from './components/MessageStream'
import { Composer } from './components/Composer'
import { chatStore, hasAuthToken } from './features/chat'
import { useChatStore } from './features/chat/hooks/useChatStore'

export default function App() {
  const [authed, setAuthed] = useState(() => hasAuthToken())
  const sidebarOpen = useChatStore((s) => s.sidebarOpen)

  const enterDemo = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('auth', '1')
    window.history.replaceState({}, '', url)
    setAuthed(true)
  }, [])

  if (!authed) {
    return <AuthGate onDemoEnter={enterDemo} />
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
