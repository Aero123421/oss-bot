import type {
  AttentionItem,
  AuthGateState,
  Bot,
  ChatError,
  ChatStatus,
  CredStatusCode,
  Group,
  Message,
  StreamEvent,
  Thread,
} from '../types'

type Listener = () => void

export type ChatState = {
  authGate: AuthGateState
  bots: Bot[]
  groups: Group[]
  threads: Thread[]
  messagesByThreadId: Record<string, Message[]>
  attention: AttentionItem[]
  selectedSessionId: string | null
  status: ChatStatus
  error: ChatError | null
  draft: string
  lastUserText: string | null
  sidebarOpen: boolean
  credReady: boolean
}

const initial: ChatState = {
  authGate: 'ok',
  bots: [],
  groups: [],
  threads: [],
  messagesByThreadId: {},
  attention: [],
  selectedSessionId: null,
  status: 'idle',
  error: null,
  draft: '',
  lastUserText: null,
  sidebarOpen: false,
  credReady: true,
}

let state: ChatState = { ...initial, messagesByThreadId: {} }
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l()
}

function setState(partial: Partial<ChatState>) {
  state = { ...state, ...partial }
  emit()
}

export const chatStore = {
  getState: () => state,
  subscribe(fn: Listener) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },

  hydrate(seed: {
    authGate: AuthGateState
    bots: Bot[]
    groups: Group[]
    threads: Thread[]
    messagesByThreadId: Record<string, Message[]>
    attention: AttentionItem[]
    selectedSessionId: string
    credReady: boolean
  }) {
    state = {
      ...state,
      ...seed,
      status: 'idle',
      error: null,
      draft: '',
      lastUserText: null,
      sidebarOpen: false,
    }
    emit()
  },

  setAuthGate(authGate: AuthGateState) {
    setState({ authGate })
  },

  setSidebarOpen(sidebarOpen: boolean) {
    setState({ sidebarOpen })
  },

  selectSession(sessionId: string) {
    setState({
      selectedSessionId: sessionId,
      status: 'idle',
      error: null,
      sidebarOpen: false,
    })
  },

  setActiveBot(threadId: string, activeBotId: string | null) {
    setState({
      threads: state.threads.map((t) =>
        t.id === threadId ? { ...t, activeBotId } : t,
      ),
    })
  },

  setDraft(draft: string) {
    setState({ draft })
  },

  setCredReady(credReady: boolean, bots?: Bot[]) {
    setState({ credReady, ...(bots ? { bots } : {}) })
  },

  setError(error: ChatError | null) {
    setState({ error, status: error ? 'error' : state.status })
  },

  beginUserTurn(threadId: string, text: string, userId: string, assistantId: string) {
    const list = state.messagesByThreadId[threadId] ?? []
    const now = Date.now()
    const thread = state.threads.find((t) => t.id === threadId)
    setState({
      messagesByThreadId: {
        ...state.messagesByThreadId,
        [threadId]: [
          ...list,
          {
            id: userId,
            threadId,
            role: 'user',
            content: text,
            status: 'complete',
            createdAt: now,
          },
          {
            id: assistantId,
            threadId,
            role: 'assistant',
            authorBotId: thread?.activeBotId ?? thread?.botId,
            authorLabel: undefined,
            content: '',
            status: 'streaming',
            createdAt: now + 1,
          },
        ],
      },
      draft: '',
      lastUserText: text,
      status: 'connecting',
      error: null,
    })
  },

  appendToken(threadId: string, messageId: string, text: string) {
    const list = state.messagesByThreadId[threadId] ?? []
    setState({
      messagesByThreadId: {
        ...state.messagesByThreadId,
        [threadId]: list.map((m) =>
          m.id === messageId
            ? { ...m, content: m.content + text, status: 'streaming' as const }
            : m,
        ),
      },
      status: 'streaming',
      error: null,
    })
  },

  patchMessage(threadId: string, messageId: string, patch: Partial<Message>) {
    const list = state.messagesByThreadId[threadId] ?? []
    setState({
      messagesByThreadId: {
        ...state.messagesByThreadId,
        [threadId]: list.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
      },
    })
  },

  applyStreamEvent(event: StreamEvent) {
    const threadId = event.chatId
    switch (event.type) {
      case 'status':
        setState({
          status:
            event.status === 'idle'
              ? 'idle'
              : event.status === 'connecting'
                ? 'connecting'
                : 'streaming',
          error: null,
        })
        break
      case 'token':
        this.appendToken(threadId, event.messageId, event.text)
        break
      case 'error':
        if (event.messageId) {
          this.patchMessage(threadId, event.messageId, { status: 'failed' })
        }
        setState({
          status: 'error',
          error: {
            code: event.code,
            message: event.message,
            retryable: event.retryable,
          },
        })
        break
      case 'done':
        this.patchMessage(threadId, event.messageId, { status: 'complete' })
        setState({ status: 'idle', error: null })
        break
      default:
        break
    }
  },

  markAborted(threadId: string, messageId: string) {
    this.patchMessage(threadId, messageId, { status: 'complete' })
    setState({ status: 'aborted', error: null })
  },
}

export function selectSelectedThread(): Thread | null {
  const id = state.selectedSessionId
  if (!id) return null
  return state.threads.find((t) => t.id === id) ?? null
}

export function selectMessages(): Message[] {
  const id = state.selectedSessionId
  if (!id) return []
  return state.messagesByThreadId[id] ?? []
}

export function credLabel(code: CredStatusCode): string {
  switch (code) {
    case 'ready':
      return 'Ready'
    case 'not_logged_in':
      return '未ログイン'
    case 'not_installed':
      return '未インストール'
    case 'doctor_failed':
      return 'doctor失敗'
    default:
      return '不明'
  }
}
