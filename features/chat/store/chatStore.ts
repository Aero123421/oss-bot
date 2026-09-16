import type {
  AdapterInfo,
  Bot,
  Chat,
  ChatError,
  ChatStatus,
  Message,
  StreamEvent,
  ToolCall,
} from '../types'

export type ChatState = {
  bots: Bot[]
  adapters: AdapterInfo[]
  chats: Chat[]
  messagesByChatId: Record<string, Message[]>
  selectedBotId: string | null
  selectedChatId: string | null
  status: ChatStatus
  error: ChatError | null
  draft: string
  /** Last user text for retry */
  lastUserText: string | null
}

type Listener = () => void

const initialState: ChatState = {
  bots: [],
  adapters: [],
  chats: [],
  messagesByChatId: {},
  selectedBotId: null,
  selectedChatId: null,
  status: 'idle',
  error: null,
  draft: '',
  lastUserText: null,
}

let state: ChatState = { ...initialState }
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l()
}

function setState(partial: Partial<ChatState> | ((s: ChatState) => Partial<ChatState>)) {
  const next = typeof partial === 'function' ? partial(state) : partial
  state = { ...state, ...next }
  emit()
}

export const chatStore = {
  getState: () => state,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  reset() {
    state = { ...initialState, messagesByChatId: {} }
    emit()
  },

  setBots(bots: Bot[]) {
    setState({ bots })
  },
  setAdapters(adapters: AdapterInfo[]) {
    setState({ adapters })
  },
  setChats(chats: Chat[]) {
    setState({ chats })
  },
  selectBot(botId: string | null) {
    const chats = state.chats.filter((c) => (botId ? c.botId === botId : true))
    const selectedChatId =
      botId && state.selectedChatId
        ? chats.some((c) => c.id === state.selectedChatId)
          ? state.selectedChatId
          : chats[0]?.id ?? null
        : state.selectedChatId
    setState({
      selectedBotId: botId,
      selectedChatId,
      status: 'idle',
      error: null,
    })
  },
  selectChat(chatId: string | null) {
    setState({
      selectedChatId: chatId,
      status: 'idle',
      error: null,
    })
  },
  setDraft(draft: string) {
    setState({ draft })
  },
  setStatus(status: ChatStatus) {
    setState({ status })
  },
  setError(error: ChatError | null) {
    setState({ error, status: error ? 'error' : state.status })
  },

  setMessages(chatId: string, messages: Message[]) {
    setState({
      messagesByChatId: { ...state.messagesByChatId, [chatId]: messages },
    })
  },

  appendMessage(message: Message) {
    const list = state.messagesByChatId[message.chatId] ?? []
    setState({
      messagesByChatId: {
        ...state.messagesByChatId,
        [message.chatId]: [...list, message],
      },
    })
  },

  patchMessage(chatId: string, messageId: string, patch: Partial<Message>) {
    const list = state.messagesByChatId[chatId] ?? []
    setState({
      messagesByChatId: {
        ...state.messagesByChatId,
        [chatId]: list.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
      },
    })
  },

  appendToken(chatId: string, messageId: string, text: string) {
    const list = state.messagesByChatId[chatId] ?? []
    setState({
      messagesByChatId: {
        ...state.messagesByChatId,
        [chatId]: list.map((m) =>
          m.id === messageId ? { ...m, content: m.content + text, status: 'streaming' } : m,
        ),
      },
    })
  },

  upsertToolCall(chatId: string, messageId: string, tool: ToolCall) {
    const list = state.messagesByChatId[chatId] ?? []
    setState({
      messagesByChatId: {
        ...state.messagesByChatId,
        [chatId]: list.map((m) => {
          if (m.id !== messageId) return m
          const existing = m.toolCalls ?? []
          const idx = existing.findIndex((t) => t.id === tool.id)
          const toolCalls =
            idx === -1
              ? [...existing, tool]
              : existing.map((t, i) => (i === idx ? { ...t, ...tool } : t))
          return { ...m, toolCalls }
        }),
      },
    })
  },

  /** Apply a backend StreamEvent to local state. */
  applyStreamEvent(event: StreamEvent) {
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
        this.appendToken(event.chatId, event.messageId, event.text)
        if (state.status !== 'streaming') setState({ status: 'streaming', error: null })
        break
      case 'tool':
        this.upsertToolCall(event.chatId, event.messageId, event.tool)
        break
      case 'error': {
        if (event.messageId) {
          this.patchMessage(event.chatId, event.messageId, { status: 'failed' })
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
      }
      case 'done':
        this.patchMessage(event.chatId, event.messageId, { status: 'complete' })
        setState({ status: 'idle', error: null })
        break
      default:
        break
    }
  },

  beginUserTurn(chatId: string, text: string, userId: string, assistantId: string) {
    const now = Date.now()
    this.appendMessage({
      id: userId,
      chatId,
      role: 'user',
      content: text,
      status: 'complete',
      createdAt: now,
    })
    this.appendMessage({
      id: assistantId,
      chatId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: now + 1,
    })
    setState({
      draft: '',
      lastUserText: text,
      status: 'connecting',
      error: null,
    })
  },

  markAborted(chatId: string, messageId: string) {
    this.patchMessage(chatId, messageId, { status: 'complete' })
    setState({ status: 'aborted', error: null })
  },
}

export function selectMessagesForChat(chatId: string | null): Message[] {
  if (!chatId) return []
  return state.messagesByChatId[chatId] ?? []
}

export function selectChatsForBot(botId: string | null): Chat[] {
  if (!botId) return state.chats
  return state.chats.filter((c) => c.botId === botId)
}
