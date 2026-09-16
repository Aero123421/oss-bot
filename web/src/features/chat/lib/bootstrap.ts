import {
  createBot,
  createGroup,
  createThread,
  fetchBots,
  fetchCredStatus,
  fetchGroups,
  fetchHealthz,
  fetchRuntime,
  fetchThread,
  fetchThreads,
  readToken,
} from './api'
import { chatStore } from '../store/chatStore'
import type { ApiMessage, UiBot, UiMessage, UiThread } from '../types'

function mapMessages(msgs: ApiMessage[], bots: UiBot[]): UiMessage[] {
  return msgs.map((m) => ({
    id: m.id,
    threadId: m.thread_id,
    role: m.role,
    authorBotId: m.bot_id,
    authorLabel: bots.find((b) => b.id === m.bot_id)?.name,
    content: m.content,
    status: 'complete' as const,
    createdAt: Date.parse(m.created_at) || Date.now(),
  }))
}

/** Ensure ≥2 bots (窓口 + Claude) and a dispatcher DM thread from CP — not fake seed chat. */
export async function bootstrapFromCp(): Promise<void> {
  const params = new URLSearchParams(window.location.search)
  if (params.get('auth') === '0') {
    chatStore.setAuthGate('missing_token')
    return
  }

  const health = await fetchHealthz().catch(() => ({ auth_gate: 'closed' as const }))
  const token = readToken()
  if (health.auth_gate === 'closed' || !token) {
    chatStore.setAuthGate('missing_token')
    return
  }

  chatStore.setAuthGate('ok')

  let { bots } = await fetchBots(token)
  if (bots.length < 2) {
    if (!bots.some((b) => /参謀|dispatcher/i.test(b.name) || b.title.includes('窓口'))) {
      await createBot(token, {
        name: '参謀',
        title: '窓口',
        role_memo: 'Dispatcher / 振り分け',
        provider: 'claude',
        runtime: 'local',
      })
    }
    if (!bots.some((b) => b.name === 'Claude' || b.provider === 'claude')) {
      await createBot(token, {
        name: '自分用Bot',
        title: 'Claude',
        role_memo: '実装相棒',
        provider: 'claude',
        runtime: 'local',
      })
    }
    ;({ bots } = await fetchBots(token))
  }

  const dispatcher =
    bots.find((b) => b.title.includes('窓口') || b.name.includes('参謀')) ?? bots[0]
  const second = bots.find((b) => b.id !== dispatcher.id) ?? bots[0]

  let { groups } = await fetchGroups(token)
  if (groups.length === 0) {
    await createGroup(token, '実装チーム', [dispatcher.id, second.id])
    ;({ groups } = await fetchGroups(token))
  }

  let { threads } = await fetchThreads(token)
  let dispatcherThread = threads.find((t) => t.active_bot_id === dispatcher.id && !t.group_id)
  if (!dispatcherThread) {
    const created = await createThread(token, {
      title: `${dispatcher.name}（窓口）`,
      active_bot_id: dispatcher.id,
    })
    dispatcherThread = created.thread
    ;({ threads } = await fetchThreads(token))
  }

  // Ensure a second DM for Bot切替 ≥2
  if (!threads.some((t) => t.active_bot_id === second.id && !t.group_id && t.id !== dispatcherThread!.id)) {
    await createThread(token, { title: second.name, active_bot_id: second.id })
    ;({ threads } = await fetchThreads(token))
  }

  const cred = await fetchCredStatus(token).catch(() => ({
    status: { status_code: 'unknown' as const },
  }))
  const runtime = await fetchRuntime(token).catch(() => ({ handles: [] as Array<{ bot_id: string | null; status: string }> }))

  const uiBots: UiBot[] = bots.map((b) => {
    const handle = runtime.handles.find((h) => h.bot_id === b.id)
    return {
      id: b.id,
      name: b.name,
      title: b.title,
      roleMemo: b.role_memo,
      provider: b.provider,
      isDispatcher: b.id === dispatcher.id,
      credStatus: b.provider === 'claude' ? cred.status.status_code : 'unknown',
      runtimeStatus: (handle?.status as UiBot['runtimeStatus']) ?? 'stopped',
    }
  })

  const uiThreads: UiThread[] = threads.map((t) => {
    const isRoom = Boolean(t.group_id)
    const bot = uiBots.find((b) => b.id === t.active_bot_id)
    return {
      id: t.id,
      kind: isRoom ? 'room' : 'dm',
      title: isRoom
        ? groups.find((g) => g.id === t.group_id)?.name ?? t.title
        : bot?.name ?? t.title,
      botId: t.active_bot_id ?? undefined,
      groupId: t.group_id ?? undefined,
      activeBotId: t.active_bot_id,
    }
  })

  // Sort: dispatcher DM first among DMs
  uiThreads.sort((a, b) => {
    if (a.id === dispatcherThread!.id) return -1
    if (b.id === dispatcherThread!.id) return 1
    if (a.kind !== b.kind) return a.kind === 'room' ? -1 : 1
    return 0
  })

  const messagesByThreadId: Record<string, UiMessage[]> = {}
  for (const t of uiThreads) {
    const detail = await fetchThread(token, t.id)
    messagesByThreadId[t.id] = mapMessages(detail.messages, uiBots)
  }

  chatStore.replaceWorkspace({
    bots: uiBots,
    threads: uiThreads,
    messagesByThreadId,
    selectedSessionId: dispatcherThread!.id,
    credReady: cred.status.status_code === 'ready',
    credCode: cred.status.status_code,
  })
}
