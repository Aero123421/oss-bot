import type { CredStatus } from '../types'

export function credStatusFromCode(code: string | undefined): CredStatus {
  switch (code) {
    case 'ready':
      return 'Ready'
    case 'not_installed':
    case 'not_registered':
      return '未インストール'
    case 'missing':
    case 'partial':
      return '未ログイン'
    default:
      return '未ログイン'
  }
}

export type CredProviderRow = {
  purpose: string
  provider: string
  status_code: string
  installed?: boolean
  hint?: string
}

export function providerIdFromPurpose(purpose: string): string {
  return purpose.startsWith('provider:') ? purpose.slice('provider:'.length) : purpose
}
