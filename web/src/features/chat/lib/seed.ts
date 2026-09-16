import type { ApprovalCard, Bot, Message, NeedActionItem, Room } from '../types'

export const SANBO_BOT_ID = 'bot_sanbo'
export const JIBUN_BOT_ID = 'bot_jibun'
export const RESEARCH_BOT_ID = 'bot_research'

export const ROOM_CHITEKI = 'room_chiteki'
export const ROOM_JISSOU = 'room_jissou'
export const DM_SANBO = 'dm_sanbo'
export const DM_JIBUN = 'dm_jibun'
export const DM_RESEARCH = 'dm_research'

/** Session/thread id for 参謀 DM — selectedSessionId default */
export const SESSION_SANBO = 'session_sanbo'
export const SESSION_JIBUN = 'session_jibun'
export const SESSION_RESEARCH = 'session_research'
export const SESSION_CHITEKI = 'session_chiteki'
export const SESSION_JISSOU = 'session_jissou'

export const APPROVAL_GITHUB = 'appr_github_reauth'

export const SEED_BOTS: Bot[] = [
  {
    id: SANBO_BOT_ID,
    name: '参謀',
    roleLabel: '窓口',
    credStatus: 'Ready',
    avatarColor: '#c9a227',
    executing: false,
  },
  {
    id: JIBUN_BOT_ID,
    name: '自分用Bot',
    roleLabel: '個人',
    credStatus: 'Ready',
    avatarColor: '#5b8def',
  },
  {
    id: RESEARCH_BOT_ID,
    name: 'リサーチ',
    roleLabel: '調査',
    credStatus: '未ログイン',
    avatarColor: '#7c6aef',
  },
]

export const SEED_ROOMS: Room[] = [
  {
    id: ROOM_CHITEKI,
    kind: 'group',
    name: '知的生産',
    memberBotIds: [SANBO_BOT_ID, RESEARCH_BOT_ID],
    unread: 'normal',
    lastPreview: '議事メモをまとめておいた',
  },
  {
    id: ROOM_JISSOU,
    kind: 'group',
    name: '実装チーム',
    memberBotIds: [SANBO_BOT_ID, JIBUN_BOT_ID],
    unread: 'none',
    lastPreview: 'PRレビュー待ち',
  },
  {
    id: DM_SANBO,
    kind: 'dm',
    name: '参謀',
    subtitle: '窓口',
    pinned: true,
    botId: SANBO_BOT_ID,
    unread: 'priority',
    credStatus: 'Ready',
    lastPreview: 'GitHub 再認証が必要です',
  },
  {
    id: DM_JIBUN,
    kind: 'dm',
    name: '自分用Bot',
    botId: JIBUN_BOT_ID,
    unread: 'none',
    credStatus: 'Ready',
    lastPreview: 'Ready — 話しかけてください',
  },
  {
    id: DM_RESEARCH,
    kind: 'dm',
    name: 'リサーチ',
    botId: RESEARCH_BOT_ID,
    unread: 'none',
    credStatus: '未ログイン',
    lastPreview: '未ログイン — Setupが必要',
  },
]

export const ROOM_TO_SESSION: Record<string, string> = {
  [DM_SANBO]: SESSION_SANBO,
  [DM_JIBUN]: SESSION_JIBUN,
  [DM_RESEARCH]: SESSION_RESEARCH,
  [ROOM_CHITEKI]: SESSION_CHITEKI,
  [ROOM_JISSOU]: SESSION_JISSOU,
}

export const SEED_APPROVALS: ApprovalCard[] = [
  {
    id: APPROVAL_GITHUB,
    sessionId: SESSION_SANBO,
    roomId: DM_SANBO,
    state: 'reauth_required',
    title: 'GitHub 再認証が必要です',
    body: 'ホスト側の GitHub 資格情報が失効しています。再認証後にランタイムへブリッジします。秘密の値はこの画面には表示されません。',
    primaryLabel: '再認証',
    secondaryLabel: '後で',
    hint: 'ホストで gh auth login → ./doctor',
  },
]

export const SEED_NEED_ACTIONS: NeedActionItem[] = [
  {
    id: 'na_appr_github',
    kind: 'approval',
    priority: 'P0',
    label: '◆ 承認 GitHub 再認証',
    roomId: DM_SANBO,
    sessionId: SESSION_SANBO,
    approvalId: APPROVAL_GITHUB,
  },
  {
    id: 'na_mention_you',
    kind: 'mention',
    priority: 'P1',
    label: '● @あなた — 振り分け確認',
    roomId: DM_SANBO,
    sessionId: SESSION_SANBO,
  },
]

export function buildSeedMessages(): Record<string, Message[]> {
  const t0 = Date.now() - 1000 * 60 * 18
  return {
    [SESSION_SANBO]: [
      {
        id: 'msg_s1',
        sessionId: SESSION_SANBO,
        role: 'user',
        content: '今日の優先タスクを整理して。GitHub 連携も見ておいて。',
        status: 'complete',
        createdAt: t0,
      },
      {
        id: 'msg_s2',
        sessionId: SESSION_SANBO,
        role: 'assistant',
        content:
          '了解です。優先は①実装チームのPRレビュー、②知的生産の議事要約、③コネクタ健全性です。\n\nGitHub 側の資格情報が失効しているため、先に再認証が必要です。下のカードから進めてください。',
        status: 'complete',
        botId: SANBO_BOT_ID,
        botRoleLabel: '参謀',
        approvalId: APPROVAL_GITHUB,
        createdAt: t0 + 40_000,
      },
      {
        id: 'msg_s3',
        sessionId: SESSION_SANBO,
        role: 'assistant',
        content: '再認証が通ったら、リサーチにも調査チケットを振り分けます。',
        status: 'complete',
        botId: SANBO_BOT_ID,
        botRoleLabel: '参謀',
        createdAt: t0 + 55_000,
      },
    ],
    [SESSION_JIBUN]: [
      {
        id: 'msg_j1',
        sessionId: SESSION_JIBUN,
        role: 'assistant',
        content: 'Ready です。個人用の作業はこのDMでどうぞ。',
        status: 'complete',
        botId: JIBUN_BOT_ID,
        botRoleLabel: '自分用Bot',
        createdAt: t0,
      },
    ],
    [SESSION_RESEARCH]: [],
    [SESSION_CHITEKI]: [
      {
        id: 'msg_c1',
        sessionId: SESSION_CHITEKI,
        role: 'assistant',
        content: '議事メモをまとめておいた。スレッドで詳細を展開できます。',
        status: 'complete',
        botId: RESEARCH_BOT_ID,
        botRoleLabel: 'リサーチ',
        createdAt: t0,
      },
    ],
    [SESSION_JISSOU]: [],
  }
}
