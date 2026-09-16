import type {
  ApprovalCard,
  Bot,
  ChatError,
  ChatStatus,
  CredStatus,
  Message,
  NeedActionItem,
  Room,
  StreamEvent,
  ToolCall,
  WsConnectionState,
} from '../types'
import {
  DM_SANBO,
  ROOM_TO_SESSION,
  SANBO_BOT_ID,
  SEED_APPROVALS,
  SEED_BOTS,
  SEED_NEED_ACTIONS,
  SEED_ROOMS,
  SESSION_SANBO,
  buildSeedMessages,
} from '../lib/seed'

export type ChatState = {
  bots: Bot[]
  rooms: Room[]
  messagesBySessionId: Record<string, Message[]>
  approvals: ApprovalCard[]
  needActions: NeedActionItem[]
  /** Thread id — switching bot must NOT wipe this */
  selectedSessionId: string | null
  selectedRoomId: string | null
  /** Responder display / routing hint — independent of thread */
  activeBotId: string | null
  status: ChatStatus
  wsState: WsConnectionState
  error: ChatError | null
  draft: string
  lastUserText: string | null
  sidebarOpen: boolean
}

type Listener = () => void

const initialState: ChatState = {
  bots: SEED_BOTS,
  rooms: SEED_ROOMS,
  messagesBySessionId: buildSeedMessages(),
  approvals: SEED_APPROVALS,
  needActions: SEED_NEED_ACTIONS,
  selectedSessionId: SESSION_SANBO,
  selectedRoomId: DM_SANBO,
  activeBotId: SANBO_BOT_ID,
  status: 'idle',
  wsState: 'idle',
  error: null,
  draft: '',
  lastUserText: null,
  sidebarOpen: false,
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
    return () => {
      listeners.delete(listener)
    }
  },

  setSidebarOpen(open: boolean) {
    setState({ sidebarOpen: open })
  },
  toggleSidebar() {
    setState({ sidebarOpen: !state.sidebarOpen })
  },

  selectRoom(roomId: string) {
    const room = state.rooms.find((r) => r.id === roomId)
    if (!room) return
    const sessionId = ROOM_TO_SESSION[roomId] ?? roomId
    const botId = room.botId ?? room.memberBotIds?.[0] ?? state.activeBotId
    setState({
      selectedRoomId: roomId,
      selectedSessionId: sessionId,
      activeBotId: botId,
      status: 'idle',
      error: null,
      sidebarOpen: false,
      rooms: state.rooms.map((r) =>
        r.id === roomId ? { ...r, unread: 'none' as const } : r,
      ),
    })
  },

  /**
   * Switch responder bot without wiping the current thread/session.
   */
  setActiveBot(botId: string) {
    if (!state.bots.some((b) => b.id === botId)) return
    setState({ activeBotId: botId })
  },

  setDraft(draft: string) {
    setState({ draft })
  },
  setStatus(status: ChatStatus) {
    setState({ status })
  },
  setWsState(wsState: WsConnectionState) {
    setState({ wsState })
  },
  setError(error: ChatError | null) {
    setState({ error, status: error ? 'error' : state.status })
  },

  resolveApproval(approvalId: string, next: ApprovalCard['state']) {
    setState({
      approvals: state.approvals.map((a) =>
        a.id === approvalId ? { ...a, state: next } : a,
      ),
      needActions:
        next === 'allowed' || next === 'denied'
          ? state.needActions.filter((n) => n.approvalId !== approvalId)
          : state.needActions,
    })
  },

  appendMessage(message: Message) {
    const list = state.messagesBySessionId[message.sessionId] ?? []
    setState({
      messagesBySessionId: {
        ...state.messagesBySessionId,
        [message.sessionId]: [...list, message],
      },
    })
  },

  patchMessage(sessionId: string, messageId: string, patch: Partial<Message>) {
    const list = state.messagesBySessionId[sessionId] ?? []
    setState({
      messagesBySessionId: {
        ...state.messagesBySessionId,
        [sessionId]: list.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
      },
    })
  },

  appendToken(sessionId: string, messageId: string, text: string) {
    const list = state.messagesBySessionId[sessionId] ?? []
    setState({
      messagesBySessionId: {
        ...state.messagesBySessionId,
        [sessionId]: list.map((m) =>
          m.id === messageId
            ? { ...m, content: m.content + text, status: 'streaming' as const }
            : m,
        ),
      },
    })
  },

  upsertToolCall(sessionId: string, messageId: string, tool: ToolCall) {
    const list = state.messagesBySessionId[sessionId] ?? []
    setState({
      messagesBySessionId: {
        ...state.messagesBySessionId,
        [sessionId]: list.map((m) => {
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

  setBotExecuting(botId: string, executing: boolean) {
    setState({
      bots: state.bots.map((b) => (b.id === botId ? { ...b, executing } : b)),
    })
  },

  applyStreamEvent(event: StreamEvent) {
    const sessionId = event.chatId
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
        if (event.status === 'streaming' && state.activeBotId) {
          this.setBotExecuting(state.activeBotId, true)
        }
        if (event.status === 'idle' && state.activeBotId) {
          this.setBotExecuting(state.activeBotId, false)
        }
        break
      case 'token':
        this.appendToken(sessionId, event.messageId, event.text)
        if (state.status !== 'streaming') setState({ status: 'streaming', error: null })
        break
      case 'tool':
        this.upsertToolCall(sessionId, event.messageId, event.tool)
        break
      case 'error': {
        if (event.messageId) {
          this.patchMessage(sessionId, event.messageId, { status: 'failed' })
        }
        if (state.activeBotId) this.setBotExecuting(state.activeBotId, false)
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
        this.patchMessage(sessionId, event.messageId, { status: 'complete' })
        if (state.activeBotId) this.setBotExecuting(state.activeBotId, false)
        setState({ status: 'idle', error: null })
        break
      default:
        break
    }
  },

  beginUserTurn(
    sessionId: string,
    text: string,
    userId: string,
    assistantId: string,
    bot?: Bot | null,
  ) {
    const now = Date.now()
    this.appendMessage({
      id: userId,
      sessionId,
      role: 'user',
      content: text,
      status: 'complete',
      createdAt: now,
    })
    this.appendMessage({
      id: assistantId,
      sessionId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      botId: bot?.id,
      botRoleLabel: bot?.name ?? bot?.roleLabel,
      createdAt: now + 1,
    })
    setState({
      draft: '',
      lastUserText: text,
      status: 'connecting',
      error: null,
    })
  },

  markAborted(sessionId: string, messageId: string) {
    this.patchMessage(sessionId, messageId, { status: 'complete' })
    if (state.activeBotId) this.setBotExecuting(state.activeBotId, false)
    setState({ status: 'aborted', error: null })
  },

  activeCredStatus(): CredStatus | undefined {
    const bot = state.bots.find((b) => b.id === state.activeBotId)
    if (bot) return bot.credStatus
    const room = state.rooms.find((r) => r.id === state.selectedRoomId)
    return room?.credStatus
  },
}

export function selectMessagesForSession(sessionId: string | null): Message[] {
  if (!sessionId) return []
  return state.messagesBySessionId[sessionId] ?? []
}

export function selectGroups(): Room[] {
  return state.rooms.filter((r) => r.kind === 'group')
}

export function selectDms(): Room[] {
  const dms = state.rooms.filter((r) => r.kind === 'dm')
  return [...dms].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return 0
  })
}
