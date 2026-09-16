export const BOT_PROVIDERS = [
  'claude',
  'codex',
  'opencode',
  'agy',
  'pi',
  'kimi',
  'grok',
] as const

export type BotProviderId = (typeof BOT_PROVIDERS)[number]

export function isBotProviderId(v: string): v is BotProviderId {
  return (BOT_PROVIDERS as readonly string[]).includes(v)
}
