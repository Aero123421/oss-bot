/** Case B / IF v4 types — CP HTTP+WS only. */

export type ChatStatus = 'idle' | 'connecting' | 'streaming' | 'error' | 'aborted'

export type CredStatusCode =
  | 'ready'
  | 'not_installed'
  | 'not_logged_in'
  | 'doctor_failed'
  | 'unknown'

export type BotPresence = 'stopped' | 'starting' | 'running' | 'error'

export type Bot = {
  id: string
  name: string
  title?: string
  roleMemo?: string
  presence: BotPresence
  credStatus: CredStatusCode
  isDispatcher?: boolean
  unreadKind?: 'none' | 'normal' | 'mention' | 'needs_action'
}

export type Group = {
  id: string
  name: string
  unreadKind?: 'none' | 'normal' | 'mention' | 'needs_action'
}

/** threads.id — primary selection */
export type Thread = {
  id: string
  kind: 'dm' | 'room'
  title: string
  botId?: string
  groupId?: string
  activeBotId: string | null
}

export type MessageRole = 'user' | 'assistant' | 'system'

export type Message = {
  id: string
  threadId: string
  role: MessageRole
  authorBotId?: string
  authorLabel?: string
  content: string
  status: 'complete' | 'streaming' | 'failed'
  card?: ApprovalCard
  createdAt: number
}

export type ApprovalCard = {
  id: string
  title: string
  body: string
  state: 'pending' | 'allowed' | 'denied' | 'deferred'
}

export type AttentionItem = {
  id: string
  kind: 'approval' | 'mention' | 'doctor'
  title: string
  threadId: string
}

export type ToolCall = {
  id: string
  name: string
  status: 'running' | 'done' | 'error'
  input?: string
  result?: string
}

export type StreamEvent =
  | { type: 'token'; chatId: string; messageId: string; text: string }
  | { type: 'tool'; chatId: string; messageId: string; tool: ToolCall }
  | { type: 'status'; chatId: string; status: 'connecting' | 'streaming' | 'idle' }
  | {
      type: 'error'
      chatId: string
      messageId?: string
      code: string
      message: string
      retryable: boolean
    }
  | { type: 'done'; chatId: string; messageId: string }

export type ChatError = {
  code: string
  message: string
  retryable: boolean
}

export type AuthGateState = 'missing_token' | 'ok'
