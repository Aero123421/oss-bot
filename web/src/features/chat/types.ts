/** Aligned with CP src/types.ts StreamEvent + UI view models. */

export type ChatStatus = 'idle' | 'connecting' | 'streaming' | 'error' | 'aborted'

export type CredStatusCode = 'ready' | 'missing' | 'partial' | 'not_registered' | 'unknown'

export type RuntimeStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'error' | 'unknown' | 'stopping'

export type ApiBot = {
  id: string
  name: string
  title: string
  role_memo: string
  provider: string
  runtime: 'docker' | 'local'
  enabled: number
}

export type ApiGroup = { id: string; name: string; created_at: string }

export type ApiThread = {
  id: string
  title: string
  active_bot_id: string | null
  group_id: string | null
  created_at: string
  updated_at: string
}

export type ApiMessage = {
  id: string
  thread_id: string
  bot_id: string | null
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export type StreamEvent =
  | { type: 'token'; threadId: string; text: string }
  | { type: 'message'; threadId: string; messageId: string; role: string; content: string }
  | { type: 'status'; threadId: string; status: string; detail?: string }
  | { type: 'error'; threadId: string; error: string }
  | { type: 'done'; threadId: string }

export type ChatError = { code: string; message: string; retryable: boolean }

export type AuthGateState = 'missing_token' | 'ok'

export type UiBot = {
  id: string
  name: string
  title: string
  roleMemo: string
  provider: string
  isDispatcher: boolean
  credStatus: CredStatusCode
  runtimeStatus: RuntimeStatus
}

export type UiThread = {
  id: string
  kind: 'dm' | 'room'
  title: string
  botId?: string
  groupId?: string
  activeBotId: string | null
}

export type UiMessage = {
  id: string
  threadId: string
  role: 'user' | 'assistant' | 'system'
  authorBotId?: string | null
  authorLabel?: string
  content: string
  status: 'complete' | 'streaming' | 'failed'
  createdAt: number
}
