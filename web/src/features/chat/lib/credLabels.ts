import type { CredStatus } from '../types'

export function credStatusFromCode(code: string | undefined): CredStatus {
  switch (code) {
    case 'ready':
      return 'Ready'
    case 'not_registered':
      return '未インストール'
    case 'missing':
    case 'partial':
      return '未ログイン'
    default:
      return '未ログイン'
  }
}
