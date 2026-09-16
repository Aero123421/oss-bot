import type { StreamEvent } from '../types'

export type MockStreamOptions = {
  chatId: string
  messageId: string
  /** Full assistant reply to stream */
  reply: string
  /** Delay between token chunks (ms) */
  chunkDelayMs?: number
  /** Approx chars per token event */
  chunkSize?: number
  /** Simulate a mid-stream failure after N chars (omit = no failure) */
  failAfterChars?: number
  signal?: AbortSignal
  onEvent: (event: StreamEvent) => void
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const t = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function chunkText(text: string, size: number): string[] {
  const out: string[] = []
  for (let i = 0; i < text.length; i += size) {
    out.push(text.slice(i, i + size))
  }
  return out.length ? out : ['']
}

/**
 * Local stand-in for WS `/ws?chatId=` until the API is up.
 * Emits the same StreamEvent union the real socket will.
 */
export async function runMockStream(opts: MockStreamOptions): Promise<void> {
  const {
    chatId,
    messageId,
    reply,
    chunkDelayMs = 28,
    chunkSize = 4,
    failAfterChars,
    signal,
    onEvent,
  } = opts

  onEvent({ type: 'status', chatId, status: 'connecting' })
  await sleep(120, signal)
  onEvent({ type: 'status', chatId, status: 'streaming' })

  const chunks = chunkText(reply, chunkSize)
  let emitted = 0

  for (const text of chunks) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    if (failAfterChars !== undefined && emitted >= failAfterChars) {
      onEvent({
        type: 'error',
        chatId,
        messageId,
        code: 'mock_failure',
        message: 'Mock stream failed (intentional).',
        retryable: true,
      })
      return
    }
    onEvent({ type: 'token', chatId, messageId, text })
    emitted += text.length
    await sleep(chunkDelayMs, signal)
  }

  onEvent({ type: 'done', chatId, messageId })
  onEvent({ type: 'status', chatId, status: 'idle' })
}

export const MOCK_DEMO_REPLY =
  '了解。サイドバーでBotを切り替えつつ、ストリーミングで返事するチャット画面を組み立てていく。' +
  '\n\n' +
  'Send中はStopに切り替わり、失敗時はStatusBarから再試行できる。'
