import type { AttentionItem, Bot, Group, Message, Thread } from '../types'

export const SEED_BOTS: Bot[] = [
  {
    id: 'bot_dispatcher',
    name: '参謀',
    title: '窓口',
    roleMemo: '振り分け・エスカレーション',
    presence: 'running',
    credStatus: 'ready',
    isDispatcher: true,
    unreadKind: 'needs_action',
  },
  {
    id: 'bot_self',
    name: '自分用Bot',
    title: 'Claude',
    roleMemo: '手元の実装相棒',
    presence: 'stopped',
    credStatus: 'ready',
    unreadKind: 'none',
  },
  {
    id: 'bot_research',
    name: 'リサーチ',
    title: '調査',
    roleMemo: '出典つき比較',
    presence: 'stopped',
    credStatus: 'not_logged_in',
    unreadKind: 'none',
  },
]

export const SEED_GROUPS: Group[] = [
  { id: 'grp_intel', name: '知的生産', unreadKind: 'normal' },
  { id: 'grp_impl', name: '実装チーム', unreadKind: 'none' },
]

export const SEED_THREADS: Thread[] = [
  {
    id: 'thr_dm_dispatcher',
    kind: 'dm',
    title: '参謀',
    botId: 'bot_dispatcher',
    activeBotId: 'bot_dispatcher',
  },
  {
    id: 'thr_dm_self',
    kind: 'dm',
    title: '自分用Bot',
    botId: 'bot_self',
    activeBotId: 'bot_self',
  },
  {
    id: 'thr_dm_research',
    kind: 'dm',
    title: 'リサーチ',
    botId: 'bot_research',
    activeBotId: 'bot_research',
  },
  {
    id: 'thr_room_intel',
    kind: 'room',
    title: '知的生産',
    groupId: 'grp_intel',
    activeBotId: 'bot_research',
  },
  {
    id: 'thr_room_impl',
    kind: 'room',
    title: '実装チーム',
    groupId: 'grp_impl',
    activeBotId: 'bot_self',
  },
]

export const SEED_ATTENTION: AttentionItem[] = [
  {
    id: 'att_1',
    kind: 'approval',
    title: 'GitHub 再認証',
    threadId: 'thr_dm_dispatcher',
  },
  {
    id: 'att_2',
    kind: 'mention',
    title: '@あなた — スコープ確認',
    threadId: 'thr_room_impl',
  },
]

export function seedMessages(): Record<string, Message[]> {
  const now = Date.now()
  return {
    thr_dm_dispatcher: [
      {
        id: 'm1',
        threadId: 'thr_dm_dispatcher',
        role: 'assistant',
        authorBotId: 'bot_dispatcher',
        authorLabel: '参謀',
        content:
          '窓口です。Room か Member に振り分けます。いま実装GOの本線は案B UI と Claude 実接続です。',
        status: 'complete',
        createdAt: now - 60_000,
      },
      {
        id: 'm2',
        threadId: 'thr_dm_dispatcher',
        role: 'user',
        content: 'S6のUIを本線で進めて。',
        status: 'complete',
        createdAt: now - 50_000,
      },
      {
        id: 'm3',
        threadId: 'thr_dm_dispatcher',
        role: 'assistant',
        authorBotId: 'bot_dispatcher',
        authorLabel: '参謀',
        content: '了解。AuthGate・窓口DM・Ready・実WSで出す。',
        status: 'complete',
        card: {
          id: 'card_gh',
          title: 'GitHub を再認証しますか？',
          body: 'コネクタのセッションが切れています。ホスト側で再認証してください。',
          state: 'pending',
        },
        createdAt: now - 40_000,
      },
    ],
    thr_room_intel: [
      {
        id: 'r1',
        threadId: 'thr_room_intel',
        role: 'assistant',
        authorBotId: 'bot_research',
        authorLabel: 'リサーチ',
        content: '調査スレッドのサンプルです。長文はスレッド脇に逃がします。',
        status: 'complete',
        createdAt: now - 120_000,
      },
    ],
    thr_dm_self: [],
    thr_dm_research: [],
    thr_room_impl: [],
  }
}
