import { NavLink, useNavigate } from 'react-router-dom'
import { Building2, UserPlus, LayoutDashboard, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/platform', label: 'Trusts', subtitle: 'All onboarded clients', icon: Building2, end: true },
  { to: '/platform/onboard', label: 'Onboard Trust', mobileLabel: 'Onboard', subtitle: 'New temple / NGO', icon: UserPlus },
  { to: '/dashboard', label: 'Trust ERP', mobileLabel: 'Trust Admin', subtitle: 'Your current trust admin', icon: LayoutDashboard },
]

function NavItem({ item, onNavigate, compact }) {
  const { to, label, mobileLabel, subtitle, icon: Icon, end } = item
  const displayLabel = compact && mobileLabel ? mobileLabel : label
  return (
    <NavLink to={to} end={end} onClick={onNavigate}>
      {({ isActive }) => (
        <div
          className={cn(
            'group flex items-center gap-3 rounded-xl transition-all',
            compact ? 'px-2.5 py-2' : 'items-start px-3 py-2.5',
            isActive
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          )}
        >
          <span className={cn('shrink-0 rounded-md p-1.5', isActive ? 'bg-white/15' : 'bg-slate-200/80')}>
            <Icon className="h-4 w-4 shrink-0" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn('font-medium', compact ? 'text-[13px]' : 'truncate text-sm')}>{displayLabel}</p>
            {!compact && subtitle ? <p className="mt-0.5 truncate text-[11px] opacity-75">{subtitle}</p> : null}
          </div>
        </div>
      )}
    </NavLink>
  )
}

export default function PlatformSidebar({ onNavigate, compact = false }) {
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
      <div className={cn('border-b border-slate-200', compact ? 'px-3 py-3 pr-10' : 'px-4 py-5')}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Fastlegal Platform</p>
        <p className={cn('font-semibold text-slate-900', compact ? 'mt-0.5 text-sm' : 'mt-1 text-base')}>
          Admin Console
        </p>
        {!compact ? <p className="mt-1 text-xs text-slate-500">Onboard trusts &amp; login users</p> : null}
      </div>

      <nav className={cn('flex-1 overflow-y-auto px-2.5', compact ? 'space-y-0.5 py-3' : 'space-y-1.5 px-3 py-4')}>
        {navItems.map((item) => (
          <NavItem key={item.to} item={item} onNavigate={onNavigate} compact={compact} />
        ))}
      </nav>

      <div className={cn('border-t border-slate-200', compact ? 'p-2' : 'p-3')}>
        {!compact ? (
          <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2">
            <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Platform Admin</p>
          </div>
        ) : null}
        <Button
          variant="ghost"
          className={cn('w-full justify-start gap-2', compact && 'h-9 px-2.5 text-sm')}
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  )
}
