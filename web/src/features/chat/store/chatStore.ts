import type {
  AuthGateState,
  ChatError,
  ChatStatus,
  CredStatusCode,
  RuntimeStatus,
  StreamEvent,
  UiBot,
  UiMessage,
  UiThread,
} from '../types'

type Listener = () => void

export type ChatState = {
  authGate: AuthGateState
  bots: UiBot[]
  threads: UiThread[]
  messagesByThreadId: Record<string, UiMessage[]>
  selectedSessionId: string | null
  status: ChatStatus
  error: ChatError | null
  draft: string
  lastUserText: string | null
  sidebarOpen: boolean
  credReady: boolean
  credCode: CredStatusCode
  streamingAssistantId: string | null
  loadError: string | null
}

const initial: ChatState = {
  authGate: 'missing_token',
  bots: [],
  threads: [],
  messagesByThreadId: {},
  selectedSessionId: null,
  status: 'idle',
  error: null,
  draft: '',
  lastUserText: null,
  sidebarOpen: false,
  credReady: false,
  credCode: 'unknown',
  streamingAssistantId: null,
  loadError: null,
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

  setAuthGate(authGate: AuthGateState) {
    setState({ authGate })
  },
  setSidebarOpen(sidebarOpen: boolean) {
    setState({ sidebarOpen })
  },
  setDraft(draft: string) {
    setState({ draft })
  },
  setLoadError(loadError: string | null) {
    setState({ loadError })
  },

  replaceWorkspace(input: {
    bots: UiBot[]
    threads: UiThread[]
    messagesByThreadId: Record<string, UiMessage[]>
    selectedSessionId: string
    credReady: boolean
    credCode: CredStatusCode
  }) {
    setState({
      ...input,
      authGate: 'ok',
      status: 'idle',
      error: null,
      loadError: null,
    })
  },

  selectSession(sessionId: string) {
    setState({
      selectedSessionId: sessionId,
      status: 'idle',
      error: null,
      sidebarOpen: false,
      streamingAssistantId: null,
    })
  },

  setThreadMessages(threadId: string, messages: UiMessage[]) {
    setState({
      messagesByThreadId: { ...state.messagesByThreadId, [threadId]: messages },
    })
  },

  setActiveBot(threadId: string, activeBotId: string) {
    setState({
      threads: state.threads.map((t) =>
        t.id === threadId ? { ...t, activeBotId, botId: t.kind === 'dm' ? activeBotId : t.botId } : t,
      ),
    })
  },

  setBotRuntime(botId: string, runtimeStatus: RuntimeStatus) {
    setState({
      bots: state.bots.map((b) => (b.id === botId ? { ...b, runtimeStatus } : b)),
    })
  },

  setCred(credReady: boolean, credCode: CredStatusCode) {
    setState({
      credReady,
      credCode,
      bots: state.bots.map((b) =>
        b.provider === 'claude' ? { ...b, credStatus: credCode } : b,
      ),
    })
  },

  beginUserTurn(threadId: string, text: string, userId: string, assistantId: string) {
    const list = state.messagesByThreadId[threadId] ?? []
    const now = Date.now()
    const thread = state.threads.find((t) => t.id === threadId)
    const bot = state.bots.find((b) => b.id === thread?.activeBotId)
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
            authorBotId: thread?.activeBotId,
            authorLabel: bot?.name,
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
      streamingAssistantId: assistantId,
    })
  },

  applyStreamEvent(ev: StreamEvent) {
    const threadId = ev.threadId
    const asst = state.streamingAssistantId
    switch (ev.type) {
      case 'status':
        setState({
          status: ev.status === 'streaming' || ev.status === 'starting' ? 'streaming' : state.status,
        })
        break
      case 'token': {
        if (!asst) break
        const list = state.messagesByThreadId[threadId] ?? []
        setState({
          status: 'streaming',
          messagesByThreadId: {
            ...state.messagesByThreadId,
            [threadId]: list.map((m) =>
              m.id === asst
                ? { ...m, content: m.content + ev.text, status: 'streaming' as const }
                : m,
            ),
          },
        })
        break
      }
      case 'message': {
        if (!asst) break
        const list = state.messagesByThreadId[threadId] ?? []
        setState({
          messagesByThreadId: {
            ...state.messagesByThreadId,
            [threadId]: list.map((m) =>
              m.id === asst
                ? {
                    ...m,
                    id: ev.messageId,
                    content: ev.content || m.content,
                    status: 'complete' as const,
                  }
                : m,
            ),
          },
        })
        break
      }
      case 'error':
        if (asst) {
          const list = state.messagesByThreadId[threadId] ?? []
          setState({
            messagesByThreadId: {
              ...state.messagesByThreadId,
              [threadId]: list.map((m) =>
                m.id === asst ? { ...m, status: 'failed' as const } : m,
              ),
            },
          })
        }
        setState({
          status: 'error',
          error: { code: 'stream_error', message: ev.error, retryable: true },
        })
        break
      case 'done':
        if (asst) {
          const list = state.messagesByThreadId[threadId] ?? []
          setState({
            messagesByThreadId: {
              ...state.messagesByThreadId,
              [threadId]: list.map((m) =>
                m.id === asst && m.status === 'streaming'
                  ? { ...m, status: 'complete' as const }
                  : m,
              ),
            },
            status: 'idle',
            streamingAssistantId: null,
          })
        } else {
          setState({ status: 'idle', streamingAssistantId: null })
        }
        break
    }
  },

  markAborted() {
    const threadId = state.selectedSessionId
    const asst = state.streamingAssistantId
    if (threadId && asst) {
      const list = state.messagesByThreadId[threadId] ?? []
      setState({
        messagesByThreadId: {
          ...state.messagesByThreadId,
          [threadId]: list.map((m) =>
            m.id === asst ? { ...m, status: 'complete' as const } : m,
          ),
        },
      })
    }
    setState({ status: 'aborted', streamingAssistantId: null, error: null })
  },

  setError(error: ChatError | null) {
    setState({ error, status: error ? 'error' : state.status })
  },
}

export function selectSelectedThread(): UiThread | null {
  const id = state.selectedSessionId
  if (!id) return null
  return state.threads.find((t) => t.id === id) ?? null
}

export function selectMessages(): UiMessage[] {
  const id = state.selectedSessionId
  if (!id) return []
  return state.messagesByThreadId[id] ?? []
}

export function credLabel(code: CredStatusCode): string {
  switch (code) {
    case 'ready':
      return 'Ready'
    case 'missing':
      return '未ログイン'
    case 'partial':
      return '部分Ready'
    case 'not_registered':
      return '未登録'
    default:
      return '不明'
  }
}

export function runtimeLabel(s: RuntimeStatus): string {
  if (s === 'running') return 'running'
  if (s === 'starting' || s === 'stopping') return s
  if (s === 'error') return 'error'
  return 'stopped'
}
