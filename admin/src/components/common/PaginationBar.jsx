import { Button } from '@/components/ui/button'

export default function PaginationBar({ pagination, onPrev, onNext }) {
  if (!pagination || pagination.totalPages <= 1) return null

  return (
    <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
      <Button variant="outline" className="w-full sm:w-auto" disabled={!pagination.hasPrev} onClick={onPrev}>
        Previous
      </Button>
      <span className="min-w-0 text-center text-sm text-muted-foreground sm:min-w-[130px]">
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <Button variant="outline" className="w-full sm:w-auto" disabled={!pagination.hasNext} onClick={onNext}>
        Next
      </Button>
    </div>
  )
}
