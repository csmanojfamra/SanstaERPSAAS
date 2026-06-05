import { Skeleton } from '@/components/ui/skeleton'

export default function TableLoadingSkeleton({ rows = 8, className = '' }) {
  return (
    <div className={`space-y-2 p-6 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}
