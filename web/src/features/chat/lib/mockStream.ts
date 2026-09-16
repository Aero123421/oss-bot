/**
 * OFF MAIN PATH — do not import from send/stream controllers.
 * Acceptance UI uses Dispatcher HTTP only.
 */
import type { StreamEvent } from '../types'

export type MockStreamOptions = {
  chatId: string
  messageId: string
  reply: string
  signal?: AbortSignal
  onEvent: (event: StreamEvent) => void
}

/** @deprecated Not used. Dispatcher path only. */
export async function runMockStream(_opts: MockStreamOptions): Promise<void> {
  throw new Error(
    'runMockStream is off the main path. useChatStream posts to /api/v1/dispatcher/messages.',
  )
}
