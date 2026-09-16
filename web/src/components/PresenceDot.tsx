type Props = {
  executing?: boolean
  label?: string
}

/** Soft presence — emphasize only when executing. */
export function PresenceDot({ executing, label }: Props) {
  return (
    <span className={`presence ${executing ? 'executing' : ''}`} title={label}>
      <span className="presence-dot" />
      <span className="presence-label">
        {executing ? '実行中' : label ?? '在席'}
      </span>
    </span>
  )
}
