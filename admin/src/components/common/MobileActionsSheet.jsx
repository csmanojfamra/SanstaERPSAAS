import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

function ActionList({ actions, onNavigate }) {
  return (
    <div className="grid gap-1">
      {actions.map((action) => {
        const Icon = action.icon
        const content = (
          <>
            {Icon ? <Icon className="h-4 w-4 text-saffron-dark" /> : null}
            {action.label}
          </>
        )
        const handleActivate = () => {
          action.onClick?.()
          onNavigate?.()
        }

        if (action.to) {
          return (
            <Button
              key={action.key || action.label}
              variant="ghost"
              className="h-11 w-full justify-start gap-3 px-3 text-sm"
              disabled={action.disabled}
              asChild
            >
              <Link to={action.to} onClick={handleActivate} className="flex items-center gap-3">
                {content}
              </Link>
            </Button>
          )
        }

        return (
          <Button
            key={action.key || action.label}
            variant="ghost"
            className="h-11 w-full justify-start gap-3 px-3 text-sm"
            disabled={action.disabled}
            onClick={handleActivate}
          >
            {content}
          </Button>
        )
      })}
    </div>
  )
}

/** Bottom sheet on mobile; optional desktop button row. */
export default function MobileActionsSheet({
  title = 'Actions',
  sheetIcon: SheetIcon = MoreHorizontal,
  sheetLabel = 'Open actions',
  actions = [],
  desktop = null,
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            variant="secondary"
            className="h-9 w-9 shrink-0 rounded-full shadow-sm sm:hidden"
            aria-label={sheetLabel}
          >
            <SheetIcon className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="px-4 pb-6 pt-3">
          <p className="mb-3 text-base font-semibold text-maroon">{title}</p>
          <ActionList actions={actions} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      {desktop ? <div className="hidden flex-wrap gap-2 sm:flex">{desktop}</div> : null}
    </>
  )
}

/** Sheet trigger only — pair with desktop buttons in PageHeader children. */
export function MobileActionsSheetTrigger({
  title = 'Actions',
  sheetIcon: SheetIcon = MoreHorizontal,
  sheetLabel = 'Open actions',
  actions = [],
}) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="secondary"
          className="h-9 w-9 shrink-0 rounded-full shadow-sm"
          aria-label={sheetLabel}
        >
          <SheetIcon className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="px-4 pb-6 pt-3">
        <p className="mb-3 text-base font-semibold text-maroon">{title}</p>
        <ActionList actions={actions} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
