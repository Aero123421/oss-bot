import { chatStore } from '../features/chat'
import type { ApprovalCard as Approval } from '../features/chat/types'
import './ApprovalCard.css'

export function ApprovalCardView({ card }: { card: Approval }) {
  if (card.state === 'allowed' || card.state === 'denied') {
    return (
      <div className={`appr appr-done ${card.state}`}>
        <strong>{card.title}</strong>
        <span>{card.state === 'allowed' ? '許可済み' : '拒否済み'}</span>
      </div>
    )
  }

  const primary = () => {
    if (card.state === 'reauth_required') {
      chatStore.resolveApproval(card.id, 'allowed')
      return
    }
    if (card.state === 'doctor_failed') {
      chatStore.resolveApproval(card.id, 'deferred')
      return
    }
    chatStore.resolveApproval(card.id, 'allowed')
  }

  const secondary = () => {
    chatStore.resolveApproval(card.id, 'deferred')
  }

  return (
    <div className="appr" role="region" aria-label="承認カード">
      <div className="appr-badge">要判断</div>
      <h3>{card.title}</h3>
      <p>{card.body}</p>
      {card.hint && <p className="appr-hint">{card.hint}</p>}
      <div className="appr-actions">
        <button type="button" className="btn btn-primary" onClick={primary}>
          {card.primaryLabel}
        </button>
        {card.secondaryLabel && (
          <button type="button" className="btn btn-ghost" onClick={secondary}>
            {card.secondaryLabel}
          </button>
        )}
      </div>
    </div>
  )
}
