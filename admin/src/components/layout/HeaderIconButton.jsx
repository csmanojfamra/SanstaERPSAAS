import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function HeaderIconButton({
  icon: Icon,
  label,
  onClick,
  to,
  variant = 'secondary',
  className,
}) {
  const classes = cn('h-9 w-9 shrink-0 rounded-full shadow-sm', className)

  if (to) {
    return (
      <Button asChild size="icon" variant={variant} className={classes} aria-label={label}>
        <Link to={to}>
          <Icon className="h-5 w-5" />
        </Link>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      size="icon"
      variant={variant}
      className={classes}
      aria-label={label}
      onClick={onClick}
    >
      <Icon className="h-5 w-5" />
    </Button>
  )
}
