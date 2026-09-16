import type { StreamEvent } from '../types'

function apiBase(): string {
  return import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ?? ''
}

function wsUrl(threadId: string, token: string): string {
  const base = apiBase()
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = base
    ? base.replace(/^https?:/, proto)
    : `${proto}//${window.location.host}`
  const url = new URL(`${host}/ws`)
  url.searchParams.set('chatId', threadId)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}

export type WsSession = {
  close: () => void
}

/** Real WebSocket client — no mock event generator on the happy path. */
export function connectChatWs(opts: {
  threadId: string
  token: string
  onEvent: (ev: StreamEvent) => void
  onOpen?: () => void
  onError?: (message: string) => void
  onClose?: () => void
}): WsSession {
  const socket = new WebSocket(wsUrl(opts.threadId, opts.token))

  socket.addEventListener('open', () => {
    opts.onOpen?.()
  })

  socket.addEventListener('message', (msg) => {
    try {
      const data = JSON.parse(String(msg.data)) as StreamEvent
      if (data && typeof data === 'object' && 'type' in data) {
        opts.onEvent(data)
      }
    } catch {
      opts.onError?.('不正なストリームデータを受信しました')
    }
  })

  socket.addEventListener('error', () => {
    opts.onError?.('WebSocket接続に失敗しました')
  })

  socket.addEventListener('close', () => {
    opts.onClose?.()
  })

  return {
    close() {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close()
      }
    },
  }
}

export async function postMessage(opts: {
  threadId: string
  text: string
  token: string
}): Promise<{ messageId?: string }> {
  const base = apiBase()
  const res = await fetch(`${base}/api/v1/chats/${encodeURIComponent(opts.threadId)}/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(opts.token
        ? {
            authorization: `Bearer ${opts.token}`,
            'x-oss-bot-token': opts.token,
          }
        : {}),
    },
    body: JSON.stringify({ text: opts.text }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `HTTP ${res.status}`)
  }
  try {
    return (await res.json()) as { messageId?: string }
  } catch {
    return {}
  }
}

export function readToken(): string {
  const fromEnv = import.meta.env.VITE_OSS_BOT_TOKEN ?? ''
  const fromQuery = new URLSearchParams(window.location.search).get('token') ?? ''
  const fromStorage = localStorage.getItem('oss_bot_token') ?? ''
  return (fromQuery || fromEnv || fromStorage).trim()
}

export function persistToken(token: string) {
  localStorage.setItem('oss_bot_token', token)
}
