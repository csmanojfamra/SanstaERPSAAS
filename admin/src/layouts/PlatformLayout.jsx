import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import PlatformSidebar from '@/components/layout/PlatformSidebar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'

export default function PlatformLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-[260px] shrink-0 lg:block">
        <div className="fixed h-full w-[260px]">
          <PlatformSidebar />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-white px-3 sm:px-4 lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(300px,88vw)] p-0">
              <PlatformSidebar compact onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="ml-2 truncate text-sm font-semibold text-slate-900">Platform Console</span>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
