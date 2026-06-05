import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close

const SheetContent = React.forwardRef(({ className, children, side = 'left', ...props }, ref) => (
  <SheetPrimitive.Portal>
    <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 gap-4 overflow-y-auto bg-background p-6 shadow-lg transition ease-in-out',
        side === 'left' && 'inset-y-0 left-0 h-full w-[280px] border-r',
        side === 'right' && 'inset-y-0 right-0 h-full w-full max-w-lg border-l sm:max-w-xl',
        className
      )}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPrimitive.Portal>
))
SheetContent.displayName = 'SheetContent'

export { Sheet, SheetTrigger, SheetClose, SheetContent }
