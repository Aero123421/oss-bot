import type {
  ApiBot,
  ApiGroup,
  ApiMessage,
  ApiThread,
  CredStatusCode,
  RuntimeStatus,
  StreamEvent,
} from '../types'

function apiBase(): string {
  return import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ?? ''
}

export function readToken(): string {
  const q = new URLSearchParams(window.location.search).get('token') ?? ''
  const env = import.meta.env.VITE_OSS_BOT_TOKEN ?? ''
  const ls = localStorage.getItem('oss_bot_token') ?? ''
  return (q || env || ls).trim()
}

export function persistToken(token: string) {
  localStorage.setItem('oss_bot_token', token)
}

function headers(token: string): HeadersInit {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
    'x-oss-bot-token': token,
  }
}

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { ...headers(token), ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export async function fetchHealthz(): Promise<{ auth_gate?: string; ok?: boolean }> {
  const res = await fetch(`${apiBase()}/healthz`)
  return (await res.json()) as { auth_gate?: string; ok?: boolean }
}

export async function fetchBots(token: string) {
  return api<{ bots: ApiBot[] }>('/api/v1/bots', token)
}

export async function createBot(
  token: string,
  body: { name: string; title?: string; role_memo?: string; provider: string; runtime?: 'docker' | 'local' },
) {
  return api<{ bot: ApiBot }>('/api/v1/bots', token, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function fetchGroups(token: string) {
  return api<{ groups: ApiGroup[]; memberships: { group_id: string; bot_id: string }[] }>(
    '/api/v1/groups',
    token,
  )
}

export async function createGroup(token: string, name: string, botIds: string[]) {
  return api<{ group: ApiGroup }>('/api/v1/groups', token, {
    method: 'POST',
    body: JSON.stringify({ name, botIds }),
  })
}

export async function fetchThreads(token: string) {
  return api<{ threads: ApiThread[] }>('/api/v1/threads', token)
}

export async function createThread(
  token: string,
  body: { title: string; active_bot_id?: string; group_id?: string },
) {
  return api<{ thread: ApiThread }>('/api/v1/threads', token, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function fetchThread(token: string, id: string) {
  return api<{ thread: ApiThread; messages: ApiMessage[] }>(`/api/v1/threads/${id}`, token)
}

export async function patchThread(
  token: string,
  id: string,
  body: { active_bot_id?: string | null; title?: string },
) {
  return api<{ thread: ApiThread }>(`/api/v1/threads/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function fetchCredStatus(token: string, purpose = 'provider:claude') {
  return api<{ status: { status_code: CredStatusCode; hint?: string } }>(
    `/api/v1/cred/status?purpose=${encodeURIComponent(purpose)}`,
    token,
  )
}

export async function fetchRuntime(token: string) {
  return api<{ handles: Array<{ id: string; bot_id: string | null; status: RuntimeStatus }> }>(
    '/api/v1/runtime',
    token,
  )
}

export async function postDispatcherMessage(
  token: string,
  body: { content: string; threadId?: string; botId?: string; groupId?: string },
) {
  return api<{ threadId: string; messageId: string; busMessageId: string; runNote?: string }>(
    '/api/v1/dispatcher/messages',
    token,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

/** Real stream via SSE (CP EventEmitter → HTTP). */
export function subscribeThreadEvents(
  threadId: string,
  token: string,
  onEvent: (ev: StreamEvent) => void,
  onError?: (msg: string) => void,
): () => void {
  const url = `${apiBase()}/api/v1/threads/${encodeURIComponent(threadId)}/events`
  // EventSource cannot set Authorization headers — pass token as query for gate
  const withToken = `${url}?token=${encodeURIComponent(token)}`
  const es = new EventSource(withToken)

  es.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as StreamEvent
      onEvent(data)
    } catch {
      onError?.('不正なストリームデータ')
    }
  }
  es.onerror = () => {
    onError?.('ストリーム接続エラー（SSE）')
    es.close()
  }
  return () => es.close()
}
