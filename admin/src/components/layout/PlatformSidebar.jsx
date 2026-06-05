import { NavLink, useNavigate } from 'react-router-dom'
import { Building2, UserPlus, LayoutDashboard, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/platform', label: 'Trusts', subtitle: 'All onboarded clients', icon: Building2, end: true },
  { to: '/platform/onboard', label: 'Onboard Trust', subtitle: 'New temple / NGO', icon: UserPlus },
  { to: '/dashboard', label: 'Trust ERP', subtitle: 'Your current trust admin', icon: LayoutDashboard },
]

function NavItem({ item, onNavigate }) {
  const { to, label, subtitle, icon: Icon, end } = item
  return (
    <NavLink to={to} end={end} onClick={onNavigate}>
      {({ isActive }) => (
        <div
          className={cn(
            'group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all',
            isActive
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          )}
        >
          <span className={cn('mt-0.5 rounded-md p-1.5', isActive ? 'bg-white/15' : 'bg-slate-200/80')}>
            <Icon className="h-4 w-4 shrink-0" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{label}</p>
            {subtitle ? <p className="mt-0.5 truncate text-[11px] opacity-75">{subtitle}</p> : null}
          </div>
        </div>
      )}
    </NavLink>
  )
}

export default function PlatformSidebar({ onNavigate }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const handleLogout = () => {
    logout()
    navigate('/login')
    onNavigate?.()
  }

  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Fastlegal Platform</p>
        <p className="mt-1 text-base font-semibold text-slate-900">Admin Console</p>
        <p className="mt-1 text-xs text-slate-500">Onboard trusts &amp; login users</p>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <NavItem key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2">
          <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Platform Admin</p>
        </div>
        <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  )
}
