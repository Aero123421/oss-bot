/** Wire format used by UI store after mapping from CP SSE. */
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

/** @deprecated CP path is SSE GET /api/v1/threads/:id/events — not /ws */
export type WsConnectionState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closed'
  | 'error'
