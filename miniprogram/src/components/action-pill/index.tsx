import { Button, Text } from '@tarojs/components'
import './index.scss'

type ActionPillVariant = 'primary' | 'tonal' | 'outline' | 'danger'

type ActionPillProps = {
  children: string
  className?: string
  compact?: boolean
  disabled?: boolean
  variant?: ActionPillVariant
  onClick?: () => void
}

const variantClasses: Record<ActionPillVariant, string> = {
  primary: 'action-pill-primary',
  tonal: 'action-pill-tonal',
  outline: 'action-pill-outline',
  danger: 'action-pill-danger'
}

export default function ActionPill ({
  children,
  className = '',
  compact = false,
  disabled = false,
  variant = 'outline',
  onClick
}: ActionPillProps) {
  const classes = [
    'action-pill',
    variantClasses[variant],
    compact ? 'action-pill-compact' : '',
    disabled ? 'action-pill-disabled' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <Button
      ariaLabel={children}
      className={classes}
      disabled={disabled}
      hoverClass={disabled ? 'none' : 'action-pill-pressed'}
      hoverStayTime={80}
      onClick={onClick}
    >
      <Text>{children}</Text>
    </Button>
  )
}
