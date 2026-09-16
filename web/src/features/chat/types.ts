/** Chat domain types — aligned with control plane StreamEvent + 案B IA. */

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

/** CredBroker status labels only — never raw secrets. */
export type CredStatus = 'Ready' | '未ログイン' | 'doctor_failed' | 'Setup中' | '障害'

export type UnreadKind = 'none' | 'normal' | 'priority'

export type RoomKind = 'group' | 'dm'

export type Room = {
  id: string
  kind: RoomKind
  name: string
  /** e.g. 窓口 */
  subtitle?: string
  /** Dispatcher 窓口 pinned at top of DMs */
  pinned?: boolean
  botId?: string
  memberBotIds?: string[]
  unread: UnreadKind
  credStatus?: CredStatus
  lastPreview?: string
}

export type Bot = {
  id: string
  name: string
  roleLabel: string
  credStatus: CredStatus
  avatarColor: string
  /** Runtime presence — emphasize only when executing */
  executing?: boolean
}

export type Message = {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  status: MessageStatus
  /** Role label for parallel responders (参謀 / リサーチ …) */
  botId?: string
  botRoleLabel?: string
  toolCalls?: ToolCall[]
  approvalId?: string
  createdAt: number
}

export type ApprovalState =
  | 'pending'
  | 'allowed'
  | 'denied'
  | 'deferred'
  | 'expired'
  | 'reauth_required'
  | 'doctor_failed'

export type ApprovalCard = {
  id: string
  sessionId: string
  roomId: string
  state: ApprovalState
  title: string
  body: string
  primaryLabel: string
  secondaryLabel?: string
  /** Safe repair hint — never secrets */
  hint?: string
}

export type NeedActionItem = {
  id: string
  kind: 'approval' | 'mention'
  priority: 'P0' | 'P1'
  label: string
  roomId: string
  sessionId: string
  approvalId?: string
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

export type WsConnectionState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closed'
  | 'error'
