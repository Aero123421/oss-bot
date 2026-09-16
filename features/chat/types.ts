/** Chat domain types — aligned with backend control plane (/bots, /adapters, /ws). */

export type ChatStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'error'
  | 'aborted'

export type MessageRole = 'user' | 'assistant' | 'system'

export type MessageStatus = 'complete' | 'streaming' | 'failed'

export type ToolCallStatus = 'running' | 'done' | 'error'

export type ToolCall = {
  id: string
  name: string
  status: ToolCallStatus
  input?: string
  result?: string
}

export type Message = {
  id: string
  chatId: string
  role: MessageRole
  content: string
  status: MessageStatus
  toolCalls?: ToolCall[]
  createdAt: number
}

export type BotStatus = 'stopped' | 'starting' | 'running' | 'error'

export type Bot = {
  id: string
  name: string
  title?: string
  description?: string
  adapterId: string
  status: BotStatus
  avatarColor?: string
  unread?: number
  updatedAt?: number
}

export type Chat = {
  id: string
  botId: string
  title: string
  updatedAt: number
}

export type AdapterInfo = {
  id: string
  name: string
  available: boolean
}

/** Wire format from WS `/ws?chatId=` (backend contract). */
export type StreamEvent =
  | { type: 'token'; chatId: string; messageId: string; text: string }
  | {
      type: 'tool'
      chatId: string
      messageId: string
      tool: ToolCall
    }
  | {
      type: 'status'
      chatId: string
      status: 'connecting' | 'streaming' | 'idle'
    }
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

export type SendPayload = {
  text: string
  attachments?: File[]
}
