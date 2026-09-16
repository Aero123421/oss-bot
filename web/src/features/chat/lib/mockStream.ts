/**
 * OFF MAIN PATH — archived local stand-in from PR #7.
 * Production / review path uses real WebSocket in useChatStream.
 * Do not wire this into send/stream controllers.
 */
import type { StreamEvent } from '../types'

export type MockStreamOptions = {
  chatId: string
  messageId: string
  reply: string
  chunkDelayMs?: number
  chunkSize?: number
  failAfterChars?: number
  signal?: AbortSignal
  onEvent: (event: StreamEvent) => void
}

/** @deprecated Not used by useChatStream. Real WS only. */
export async function runMockStream(_opts: MockStreamOptions): Promise<void> {
  throw new Error(
    'runMockStream is off the main path. useChatStream connects to /ws?chatId=.',
  )
}

export const MOCK_DEMO_REPLY =
  '（mockStream は本線外です。実 WebSocket 応答を待ってください）'
