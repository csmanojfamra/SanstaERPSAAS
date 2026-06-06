import { useEffect, useState } from 'react'
import { Menu, LogOut, UserCircle2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import Sidebar from './Sidebar'

export default function Topbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const roleLabel = user?.role || 'USER'
  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <header className="sticky top-0 z-40 flex h-14 min-h-[3.5rem] items-center justify-between gap-2 border-b bg-white/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 lg:hidden">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[min(300px,88vw)] border-0 p-0 [&>button]:text-white [&>button]:hover:text-white/90"
          >
            <Sidebar compact onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="truncate text-sm font-semibold text-maroon">Temple Admin</span>
      </div>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto gap-2 rounded-full border border-border/70 px-2 py-1.5 hover:bg-muted/50"
              aria-label="Open account menu"
            >
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight text-foreground">{user?.name || 'Administrator'}</p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{roleLabel}</p>
              </div>
              <Avatar className="h-9 w-9 border border-maroon/20 shadow-sm">
                <AvatarFallback className="bg-maroon text-white">{initials || 'U'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="space-y-0.5">
              <p className="text-sm font-semibold">{user?.name || 'Administrator'}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <button type="button" className="flex w-full items-center gap-2" onClick={() => navigate('/settings')}>
                <UserCircle2 className="h-4 w-4" />
                Profile Details
              </button>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <button type="button" className="flex w-full items-center gap-2 text-red-600" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
