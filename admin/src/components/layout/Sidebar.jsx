import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Heart,
  Users,
  Wallet,
  FileBarChart,
  ClipboardCheck,
  ScrollText,
  Settings,
  LogOut,
  BookOpen,
  Building2,
} from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navSections = [
  {
    title: 'Operations',
    items: [
      { to: '/dashboard', label: 'Dashboard Insights', subtitle: 'Overview & analytics', icon: LayoutDashboard },
      { to: '/donations', label: 'Donation Register', subtitle: 'Receipts & donor records', icon: Heart },
      { to: '/trustees', label: 'Trustees', subtitle: 'Contributions & roles', icon: Users },
      { to: '/expenses', label: 'Expenses', subtitle: 'Track spend', icon: Wallet },
    ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/cash-book', label: 'Cash Ledger', subtitle: 'Debit/Credit balances', icon: BookOpen, adminOnly: true },
      { to: '/reconciliation', label: 'Bank Reconciliation', subtitle: 'Match transactions', icon: ClipboardCheck },
      { to: '/reports', label: 'Financial Reports & Registers', subtitle: 'Compliance & audit reporting', icon: FileBarChart },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/audit-logs', label: 'Activity Logs', subtitle: 'User activity history', icon: ScrollText },
      { to: '/settings', label: 'Settings', subtitle: 'System preferences', icon: Settings, adminOnly: true },
    ],
  },
]

function SidebarNavItem({ item, onNavigate }) {
  const { to, label, subtitle, icon: Icon } = item
  return (
    <NavLink to={to} onClick={onNavigate}>
      {({ isActive }) => (
        <div
          className={cn(
            'group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all duration-200',
            isActive
              ? 'bg-[#f4a742] text-white shadow-[0_6px_16px_rgba(0,0,0,0.22)]'
              : 'text-[rgba(255,255,255,0.82)] hover:bg-white/10 hover:text-white'
          )}
        >
          <span
            className={cn(
              'mt-0.5 rounded-md p-1.5 transition-all duration-200',
              isActive ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10 group-hover:translate-x-0.5'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium leading-tight">{label}</p>
            {subtitle ? (
              <p className={cn('mt-0.5 truncate text-[11px] leading-tight', isActive ? 'text-white/85' : 'text-white/60')}>
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </NavLink>
  )
}

export default function Sidebar({ onNavigate }) {
  const navigate = useNavigate()
  const trust = useAuthStore((s) => s.trust)
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const userRole = useAuthStore((s) => s.user?.role)
  const isPlatformAdmin = useAuthStore((s) => s.user?.is_platform_admin)

  const handleLogout = () => {
    logout()
    navigate('/login')
    onNavigate?.()
  }

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.adminOnly || userRole === 'ADMIN'),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#7B1C1C] to-[#5C1515] text-white shadow-[inset_-1px_0_0_rgba(255,255,255,0.08)]">
      <div className="border-b border-white/10 px-4 py-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-xl" aria-hidden>
            🛕
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/65">Temple Trust</p>
            <p className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug text-white/95">
              {trust?.name_hindi || trust?.name || 'Admin'}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {visibleSections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">
              {section.title}
            </p>
            <div className="space-y-1.5">
              {section.items.map((item) => (
                <SidebarNavItem key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
        {isPlatformAdmin ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">
              Platform
            </p>
            <SidebarNavItem
              item={{
                to: '/platform',
                label: 'Platform Console',
                subtitle: 'Onboard trusts & users',
                icon: Building2,
              }}
              onNavigate={onNavigate}
            />
          </div>
        ) : null}
      </nav>

      <div className="border-t border-white/12 p-3">
        <div className="mb-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5">
          <p className="truncate text-sm font-medium text-white">{user?.name || 'Administrator'}</p>
          <div className="mt-1 inline-flex rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/85">
            {userRole || 'USER'}
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 rounded-xl text-white hover:bg-white/12 hover:text-white"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  )
}
