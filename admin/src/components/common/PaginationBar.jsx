import { Button } from '@/components/ui/button'

export default function PaginationBar({ pagination, onPrev, onNext }) {
  if (!pagination || pagination.totalPages <= 1) return null

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
      <Button variant="outline" disabled={!pagination.hasPrev} onClick={onPrev}>
        Previous
      </Button>
      <span className="min-w-[130px] text-center text-sm text-muted-foreground">
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <Button variant="outline" disabled={!pagination.hasNext} onClick={onNext}>
        Next
      </Button>
    </div>
  )
}
