import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export default function CompactStatCard({ label, shortLabel, value, sub, valueClassName, className }) {
  return (
    <Card className={cn('border-border/80', className)}>
      <CardContent className="flex flex-col gap-0.5 p-2.5 sm:gap-1 sm:p-3">
        <p className="text-xs font-medium leading-snug text-muted-foreground">
          <span className="sm:hidden">{shortLabel || label}</span>
          <span className="hidden sm:inline">{label}</span>
        </p>
        <p className={cn('text-xl font-semibold tabular-nums leading-none sm:text-lg', valueClassName)}>
          {value}
        </p>
        {sub ? <p className="text-[10px] text-muted-foreground line-clamp-2 sm:text-[11px]">{sub}</p> : null}
      </CardContent>
    </Card>
  )
}
