import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export default function RequiredLabel({ children, optional = false, htmlFor, className }) {
  return (
    <Label htmlFor={htmlFor} className={cn(className)}>
      {children}
      {optional ? (
        <span className="font-normal text-muted-foreground"> (Optional)</span>
      ) : (
        <span className="text-destructive"> *</span>
      )}
    </Label>
  )
}
