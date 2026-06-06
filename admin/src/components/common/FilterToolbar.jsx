import { cn } from '@/lib/utils'

/** Wraps filters in a compact mobile card; desktop stays flush. */
export default function FilterToolbar({ children, className, layout = 'grid' }) {
  const layoutClass =
    layout === 'none' ? '' : layout === 'grid' ? 'filter-grid !mb-0' : 'period-bar mb-0'

  return (
    <div
      className={cn(
        'mb-3 rounded-lg border border-border/70 bg-card px-2.5 py-2.5 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0',
        className
      )}
    >
      <div className={layoutClass}>{children}</div>
    </div>
  )
}
