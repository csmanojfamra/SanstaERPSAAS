import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useMarkNotificationRead } from '@/hooks/useAnalytics'
import EmptyState from '@/components/common/EmptyState'
import TableLoadingSkeleton from '@/components/common/TableLoadingSkeleton'

const TYPE_ICONS = {
  DONATION: '💰',
  EXPENSE: '📉',
  SYSTEM: '⚙️',
  RECEIPT: '🧾',
  SECURITY: '🔒',
}

const PRIORITY_STYLES = {
  LOW: 'border-gray-200 bg-gray-50',
  MEDIUM: 'border-blue-200 bg-blue-50',
  HIGH: 'border-orange-200 bg-orange-50',
  CRITICAL: 'border-red-300 bg-red-50',
}

export default function NotificationsPanel({ notifications = [], unreadCount = 0, loading }) {
  const markRead = useMarkNotificationRead()
  const feedItems = notifications.slice(0, 6)

  if (loading) {
    return <TableLoadingSkeleton rows={4} className="p-0" />
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-saffron-dark" />
          <h3 className="text-sm font-semibold text-foreground sm:text-base">Operational Alerts</h3>
          {unreadCount > 0 && (
            <Badge variant="default" className="bg-saffron text-white">
              {unreadCount}
            </Badge>
          )}
        </div>
        <Button asChild variant="ghost" className="h-8 px-2 text-xs text-saffron-dark hover:text-saffron-dark">
          <Link to="/audit-logs">Activity Register</Link>
        </Button>
      </div>

      {!feedItems.length ? (
        <EmptyState compact title="No notifications" />
      ) : (
        <ul className="max-h-[280px] space-y-2 overflow-y-auto pr-1 sm:max-h-[320px]">
          {feedItems.map((n) => (
            <li
              key={n.id}
              className={cn(
                'rounded-lg border p-2 text-sm sm:p-2.5',
                PRIORITY_STYLES[n.priority] || PRIORITY_STYLES.MEDIUM,
                !n.is_read && 'ring-1 ring-saffron/40'
              )}
            >
              <div className="flex gap-2">
                <span className="pt-0.5 text-base shrink-0">{TYPE_ICONS[n.type] || '📌'}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight text-foreground">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-[11px] tracking-wide text-muted-foreground">
                    {new Date(n.created_at).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {!n.is_read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1.5 h-6 px-1.5 text-[11px]"
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate(n.id)}
                    >
                      Mark as read
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
