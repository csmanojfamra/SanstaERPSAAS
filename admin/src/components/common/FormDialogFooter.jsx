import { cn } from '@/lib/utils'

/** Dialog action row — scrolls with form content (not sticky). */
export default function FormDialogFooter({ children, className }) {
  return (
    <div className={cn('mt-4 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:flex-wrap sm:justify-end', className)}>
      {children}
    </div>
  )
}
