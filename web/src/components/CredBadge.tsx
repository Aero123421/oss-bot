import type { CredStatus } from '../features/chat/types'

export function CredBadge({ status }: { status?: CredStatus }) {
  if (!status) return null
  const cls =
    status === 'Ready'
      ? 'cred ready'
      : status === '未ログイン'
        ? 'cred login'
        : 'cred warn'
  return <span className={cls}>{status}</span>
}
