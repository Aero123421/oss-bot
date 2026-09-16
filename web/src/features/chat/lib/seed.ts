import type { ApprovalCard, Bot, Message, NeedActionItem, Room } from '../types'

export const SANBO_BOT_ID = 'bot_sanbo'
export const JIBUN_BOT_ID = 'bot_jibun'
export const RESEARCH_BOT_ID = 'bot_research'

export const ROOM_CHITEKI = 'room_chiteki'
export const ROOM_JISSOU = 'room_jissou'
export const DM_SANBO = 'dm_sanbo'
export const DM_JIBUN = 'dm_jibun'
export const DM_RESEARCH = 'dm_research'

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
    provider: 'claude',
    credStatus: 'Ready',
    avatarColor: '#c9a227',
    executing: false,
  },
  {
    id: JIBUN_BOT_ID,
    name: '自分用Bot',
    roleLabel: '個人',
    provider: 'claude',
    credStatus: 'Ready',
    avatarColor: '#5b8def',
  },
  {
    id: RESEARCH_BOT_ID,
    name: 'リサーチ',
    roleLabel: '調査',
    provider: 'codex',
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
    lastPreview: '議事メモ',
  },
  {
    id: ROOM_JISSOU,
    kind: 'group',
    name: '実装チーム',
    memberBotIds: [SANBO_BOT_ID, JIBUN_BOT_ID],
    unread: 'none',
    lastPreview: 'PR',
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
    lastPreview: 'GitHub',
  },
  {
    id: DM_JIBUN,
    kind: 'dm',
    name: '自分用Bot',
    botId: JIBUN_BOT_ID,
    unread: 'none',
    credStatus: 'Ready',
    lastPreview: 'Ready',
  },
  {
    id: DM_RESEARCH,
    kind: 'dm',
    name: 'リサーチ',
    botId: RESEARCH_BOT_ID,
    unread: 'none',
    credStatus: '未ログイン',
    lastPreview: '未ログイン',
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
    title: 'GitHub reauth',
    body: 'Host GitHub credentials expired. Secrets are not shown here.',
    primaryLabel: '再認証',
    secondaryLabel: '後で',
    hint: 'gh auth login then ./doctor',
  },
]

export const SEED_NEED_ACTIONS: NeedActionItem[] = [
  {
    id: 'na_appr_github',
    kind: 'approval',
    priority: 'P0',
    label: 'GitHub reauth',
    roomId: DM_SANBO,
    sessionId: SESSION_SANBO,
    approvalId: APPROVAL_GITHUB,
  },
]

export function buildSeedMessages(): Record<string, Message[]> {
  const t0 = Date.now() - 1000 * 60 * 18
  return {
    [SESSION_SANBO]: [
      {
        id: 'msg_s1',
        sessionId: SESSION_SANBO,
        role: 'assistant',
        content: 'Dispatcher window. Provider must be selected when creating bots.',
        status: 'complete',
        botId: SANBO_BOT_ID,
        botRoleLabel: '参謀',
        createdAt: t0,
      },
    ],
    [SESSION_JIBUN]: [],
    [SESSION_RESEARCH]: [],
    [SESSION_CHITEKI]: [],
    [SESSION_JISSOU]: [],
  }
}
