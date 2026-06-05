import { cn } from '@/lib/utils'
import EmptyState from '@/components/common/EmptyState'
import TableLoadingSkeleton from '@/components/common/TableLoadingSkeleton'

const ACTION_ICONS = {
  CREATE: '📝',
  UPDATE: '✏️',
  DELETE: '🗑️',
  WHATSAPP_SEND: '📤',
  RECEIPT_REGENERATE: '🧾',
  RECONCILE: '✅',
  LOGIN: '🔐',
}

function iconFor(log) {
  return ACTION_ICONS[log.action] || '📋'
}

const MODULE_COLORS = {
  DONATIONS: 'border-saffron',
  EXPENSES: 'border-maroon',
  TRUSTEES: 'border-gold',
  SECURITY: 'border-red-400',
}

export default function ActivityTimeline({ logs = [], loading }) {
  if (loading) {
    return <TableLoadingSkeleton rows={5} className="p-0" />
  }

  if (!logs.length) {
    return <EmptyState compact title="No high-priority activity" />
  }

  return (
    <div className="max-h-[340px] overflow-y-auto pr-1 sm:max-h-[420px]">
      <ul className="space-y-2.5">
        {logs.map((log) => (
          <li
            key={log.id}
            className={cn(
              'flex gap-2 rounded-lg border-l-4 bg-white p-2 shadow-sm sm:gap-2.5 sm:p-2.5',
              MODULE_COLORS[log.module] || 'border-gray-300'
            )}
          >
            <span className="pt-0.5 text-base shrink-0" aria-hidden>
              {iconFor(log)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium leading-tight text-foreground">{log.description}</p>
              <p className="mt-0.5 text-[11px] tracking-wide text-muted-foreground">
                {log.user?.name || 'System'} · {log.module}
              </p>
              <p className="text-[11px] tracking-wide text-muted-foreground">
                {new Date(log.created_at).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
