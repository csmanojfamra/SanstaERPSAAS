import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function EmptyState({ title = 'No data found', description, className, compact = false }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center text-muted-foreground',
        compact ? 'gap-1 py-6' : 'gap-2 py-12',
        className
      )}
    >
      <Inbox className={cn('text-muted-foreground/80', compact ? 'h-4 w-4' : 'h-5 w-5')} />
      <p className={cn('font-medium text-foreground', compact ? 'text-sm' : 'text-base')}>{title}</p>
      {description ? <p className={cn(compact ? 'text-xs' : 'text-sm')}>{description}</p> : null}
    </div>
  )
}
