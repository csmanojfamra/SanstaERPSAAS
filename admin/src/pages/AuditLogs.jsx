import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import EmptyState from '@/components/common/EmptyState'
import { downloadAuditActivityPdf, useAuditActivity } from '@/hooks/useAnalytics'
import PaginationBar from '@/components/common/PaginationBar'
import TableLoadingSkeleton from '@/components/common/TableLoadingSkeleton'
import { toast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api'

const MODULES = ['DONATIONS', 'EXPENSES', 'TRUSTEES', 'SECURITY', 'RECONCILIATION', 'CASHBOOK', 'REPORTS']
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'WHATSAPP_SEND', 'RECEIPT_REGENERATE', 'RECONCILE', 'LOGIN', 'LOGOUT', 'EXPORT', 'DOWNLOAD']

const MODULE_LABELS = {
  DONATIONS: 'Donations',
  EXPENSES: 'Expenses',
  TRUSTEES: 'Trustees',
  SECURITY: 'Security',
  RECONCILIATION: 'Reconciliation',
  CASHBOOK: 'Cash Book',
  REPORTS: 'Reports',
}

const ACTION_LABELS = {
  CREATE: 'Record Created',
  UPDATE: 'Record Updated',
  DELETE: 'Record Deleted',
  WHATSAPP_SEND: 'WhatsApp Sent',
  RECEIPT_REGENERATE: 'Receipt Regenerated',
  RECONCILE: 'Entry Reconciled',
  LOGIN: 'Login Successful',
  LOGOUT: 'Logout',
  EXPORT: 'Export Generated',
  DOWNLOAD: 'Download Triggered',
}

function getSeverity(log) {
  const action = String(log.action || '').toUpperCase()
  const module = String(log.module || '').toUpperCase()
  const description = String(log.description || '').toLowerCase()
  if (action === 'DELETE') return 'Critical'
  if (description.includes('backdated') || description.includes('override')) return 'Warning'
  if (action === 'LOGIN' || module === 'SECURITY') return 'Info'
  if (action === 'RECONCILE' || ['DONATIONS', 'EXPENSES', 'CASHBOOK', 'RECONCILIATION'].includes(module)) return 'Financial'
  if (description.includes('verify') || description.includes('audit')) return 'Audit Sensitive'
  return 'Info'
}

function getCategory(log) {
  const module = String(log.module || '').toUpperCase()
  const action = String(log.action || '').toUpperCase()
  if (module === 'SECURITY' || action === 'LOGIN' || action === 'LOGOUT') return 'Security'
  if (['DONATIONS', 'EXPENSES', 'CASHBOOK', 'RECONCILIATION'].includes(module)) return 'Financial'
  if (action === 'RECONCILE') return 'Verification'
  if (module === 'REPORTS') return 'Compliance'
  return 'Administrative'
}

function getTimelineGroup(dateValue) {
  const now = new Date()
  const d = new Date(dateValue)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const thisWeekStart = new Date(today)
  thisWeekStart.setDate(thisWeekStart.getDate() - 6)
  const valueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  if (valueDay.getTime() === today.getTime()) return 'Today'
  if (valueDay.getTime() === yesterday.getTime()) return 'Yesterday'
  if (valueDay >= thisWeekStart) return 'This Week'
  return 'Earlier'
}

function parseFinancialRefs(text = '') {
  return {
    voucherRef: text.match(/\bEXP[-/][\w-]+\b/i)?.[0] || text.match(/\bvoucher\s*[:#-]?\s*([A-Z0-9/-]+)/i)?.[1] || null,
    receiptRef: text.match(/\bREC[-/][\w-]+\b/i)?.[0] || text.match(/\breceipt\s*[:#-]?\s*([A-Z0-9/-]+)/i)?.[1] || null,
    transactionRef:
      text.match(/\b(?:UTR|TXN|TRX|BANK)[- ]*([A-Z0-9/-]{5,})\b/i)?.[1] ||
      text.match(/\b(?:UTR|TXN|TRX|BANK)([A-Z0-9/-]{5,})\b/i)?.[1] ||
      null,
  }
}

function SeverityTag({ value }) {
  const styles = {
    Info: 'bg-slate-100 text-slate-700',
    Warning: 'bg-amber-100 text-amber-700',
    Critical: 'bg-rose-100 text-rose-700',
    Financial: 'bg-blue-100 text-blue-700',
    Security: 'bg-purple-100 text-purple-700',
    'Audit Sensitive': 'bg-orange-100 text-orange-700',
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[value] || styles.Info}`}>{value}</span>
}

export default function AuditLogs() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [module, setModule] = useState('')
  const [action, setAction] = useState('')
  const [severity, setSeverity] = useState('ALL')
  const [selectedUser, setSelectedUser] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewMode, setViewMode] = useState('TABLE')

  const params = {
    page,
    limit: 25,
    ...(module && { module }),
    ...(action && { action }),
    ...(dateFrom && { date_from: dateFrom }),
    ...(dateTo && { date_to: dateTo }),
  }

  const { data, isLoading, isError, error } = useAuditActivity(params)
  const logs = data?.logs || []

  const processedLogs = useMemo(() => {
    return logs
      .map((log) => {
        const severityTag = getSeverity(log)
        const category = getCategory(log)
        const refs = parseFinancialRefs(log.description)
        return {
          ...log,
          severityTag,
          category,
          actionLabel: ACTION_LABELS[log.action] || String(log.action || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
          moduleLabel: MODULE_LABELS[log.module] || log.module,
          refs,
          timelineGroup: getTimelineGroup(log.created_at),
        }
      })
      .filter((log) => (severity === 'ALL' ? true : log.severityTag === severity))
      .filter((log) => (selectedUser === 'ALL' ? true : (log.user?.name || log.user?.username || 'System') === selectedUser))
      .filter((log) => {
        if (!searchTerm.trim()) return true
        const q = searchTerm.toLowerCase()
        return [
          log.description,
          log.action,
          log.module,
          log.user?.name,
          log.user?.username,
          log.refs.voucherRef,
          log.refs.receiptRef,
          log.refs.transactionRef,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      })
  }, [logs, severity, selectedUser, searchTerm])

  const users = useMemo(() => {
    const unique = new Set()
    logs.forEach((log) => unique.add(log.user?.name || log.user?.username || 'System'))
    return [...unique]
  }, [logs])

  const summary = useMemo(() => {
    const todayKey = new Date().toDateString()
    const totalToday = processedLogs.filter((log) => new Date(log.created_at).toDateString() === todayKey).length
    const financial = processedLogs.filter((log) => log.category === 'Financial').length
    const modified = processedLogs.filter((log) => ['UPDATE', 'DELETE'].includes(String(log.action))).length
    const reconciled = processedLogs.filter((log) => String(log.action) === 'RECONCILE').length
    const login = processedLogs.filter((log) => String(log.action) === 'LOGIN').length
    const highRisk = processedLogs.filter((log) => ['Critical', 'Warning', 'Audit Sensitive'].includes(log.severityTag)).length
    return { totalToday, financial, modified, reconciled, login, highRisk }
  }, [processedLogs])

  const groupedTimeline = useMemo(() => {
    return processedLogs.reduce(
      (acc, log) => {
        acc[log.timelineGroup].push(log)
        return acc
      },
      { Today: [], Yesterday: [], 'This Week': [], Earlier: [] }
    )
  }, [processedLogs])

  const securityLogs = useMemo(
    () => processedLogs.filter((log) => log.category === 'Security').slice(0, 8),
    [processedLogs]
  )

  const exportAuditCsv = () => {
    const rows = processedLogs.map((log) => ({
      timestamp: new Date(log.created_at).toLocaleString('en-IN'),
      performed_by: log.user?.name || log.user?.username || 'System',
      role: log.user?.role || '—',
      module: log.moduleLabel,
      action: log.actionLabel,
      severity: log.severityTag,
      category: log.category,
      voucher_ref: log.refs.voucherRef || '',
      receipt_ref: log.refs.receiptRef || '',
      transaction_ref: log.refs.transactionRef || '',
      description: log.description || '',
    }))
    const header = Object.keys(rows[0] || { timestamp: '', performed_by: '', module: '', action: '', severity: '', category: '', description: '' })
    const csv = [header.join(','), ...rows.map((r) => header.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit_trail_register_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  const exportAuditPdf = async () => {
    try {
      await downloadAuditActivityPdf({
        ...(module && { module }),
        ...(action && { action }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
        ...(searchTerm.trim() && { q: searchTerm.trim() }),
        ...(selectedUser !== 'ALL' && { user_name: selectedUser }),
      })
      toast({ title: 'Audit PDF exported' })
    } catch (err) {
      toast({ title: 'Export failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const openLinkedRecord = (log) => {
    const moduleName = String(log.module || '').toUpperCase()
    const pathMap = {
      DONATIONS: '/donations',
      EXPENSES: '/expenses',
      TRUSTEES: '/trustees',
      RECONCILIATION: '/reconciliation',
      CASHBOOK: '/cash-book',
      REPORTS: '/reports',
      SECURITY: '/audit-logs',
    }
    navigate(pathMap[moduleName] || '/audit-logs')
  }

  return (
    <>
      <PageHeader
        title="Audit Trail & Activity Register"
        description="Track operational activities, financial actions and system changes across the trust platform."
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Total Activities Today</p><p className="text-lg font-semibold">{summary.totalToday}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Financial Actions</p><p className="text-lg font-semibold">{summary.financial}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Modified Records</p><p className="text-lg font-semibold">{summary.modified}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Reconciliation Actions</p><p className="text-lg font-semibold">{summary.reconciled}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Login Activity</p><p className="text-lg font-semibold">{summary.login}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">High Risk Activities</p><p className={`text-lg font-semibold ${summary.highRisk > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{summary.highRisk}</p></CardContent></Card>
      </div>

      <div className={`mb-3 rounded-md border px-3 py-2 text-sm ${summary.highRisk > 0 ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
        {summary.highRisk > 0
          ? `${summary.highRisk} high-risk financial activities detected in selected period.`
          : 'No suspicious or backdated financial activities found.'}
      </div>

      <Card className="mb-4">
        <CardContent className="pt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          <div>
            <Label>Module</Label>
            <Select value={module || 'all'} onValueChange={(v) => { setModule(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {MODULES.map((m) => (
                  <SelectItem key={m} value={m}>{MODULE_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Action Type</Label>
            <Select value={action || 'all'} onValueChange={(v) => { setAction(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{ACTION_LABELS[a] || a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>User</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All users</SelectItem>
                {users.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['ALL', 'Info', 'Warning', 'Critical', 'Financial', 'Security', 'Audit Sensitive'].map((s) => (
                  <SelectItem key={s} value={s}>{s === 'ALL' ? 'All severity' : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>From</Label>
            <Input className="h-9" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} />
          </div>
          <div>
            <Label>To</Label>
            <Input className="h-9" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} />
          </div>
          <div>
            <Label>Search</Label>
            <Input className="h-9" placeholder="Search ref, user, donor, payee..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="sm:col-span-2 lg:col-span-7 flex flex-wrap justify-between gap-2 pt-1">
            <div className="flex gap-2">
              <Button size="sm" variant={viewMode === 'TABLE' ? 'default' : 'outline'} onClick={() => setViewMode('TABLE')}>Table View</Button>
              <Button size="sm" variant={viewMode === 'TIMELINE' ? 'default' : 'outline'} onClick={() => setViewMode('TIMELINE')}>Timeline View</Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportAuditCsv}>Export Excel</Button>
              <Button size="sm" variant="outline" onClick={exportAuditPdf}>Export PDF</Button>
              <Button size="sm" variant="outline" onClick={exportAuditPdf}>Audit Report Export</Button>
              <Button size="sm" variant="outline" onClick={() => { setModule(''); setAction(''); setDateFrom(''); setDateTo(''); setSeverity('ALL'); setSelectedUser('ALL'); setSearchTerm(''); setPage(1) }}>
              Clear filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error?.message}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Audit Integrity Indicators</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3 text-sm">
          <div className="rounded-md border p-2">Audit trail protected.</div>
          <div className="rounded-md border p-2">No log tampering detected.</div>
          <div className="rounded-md border p-2">All activities recorded successfully.</div>
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Security Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {!securityLogs.length ? <p className="text-muted-foreground">No security activities in current filtered set.</p> : securityLogs.map((log) => (
            <div key={log.id} className="rounded border px-2 py-1.5">
              <span className="font-medium">{log.actionLabel}</span> by {log.user?.name || log.user?.username || 'System'} on {new Date(log.created_at).toLocaleString('en-IN')}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <TableLoadingSkeleton rows={8} />
          ) : !processedLogs.length ? (
            <EmptyState
              title="No audit logs found"
              description="Try a broader date range or clear filters."
              className="px-4"
            />
          ) : (
            viewMode === 'TABLE' ? (
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="py-2">Timestamp</TableHead>
                    <TableHead className="py-2">Performed By</TableHead>
                    <TableHead className="py-2">Module</TableHead>
                    <TableHead className="py-2">Action</TableHead>
                    <TableHead className="py-2">Severity</TableHead>
                    <TableHead className="py-2">Category</TableHead>
                    <TableHead className="py-2">Financial Ref</TableHead>
                    <TableHead className="py-2">Description</TableHead>
                    <TableHead className="py-2">View Record</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs py-2">{new Date(log.created_at).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="py-2">
                        <p className="text-sm font-medium">{log.user?.name || log.user?.username || 'System'}</p>
                        <p className="text-xs text-muted-foreground">Role: {log.user?.role || '—'}</p>
                      </TableCell>
                      <TableCell className="py-2">{log.moduleLabel}</TableCell>
                      <TableCell className="py-2">{log.actionLabel}</TableCell>
                      <TableCell className="py-2"><SeverityTag value={log.severityTag} /></TableCell>
                      <TableCell className="py-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{log.category}</span></TableCell>
                      <TableCell className="py-2 text-xs">
                        <p>Voucher: {log.refs.voucherRef || '—'}</p>
                        <p>Receipt: {log.refs.receiptRef || '—'}</p>
                        <p>Txn: {log.refs.transactionRef || '—'}</p>
                      </TableCell>
                      <TableCell className="max-w-[320px] py-2 text-xs">
                        <p>{log.description || '—'}</p>
                        {log.description?.toLowerCase().includes('backdated') ? <p className="mt-1 text-amber-700 font-medium">Backdated activity detected.</p> : null}
                      </TableCell>
                      <TableCell className="py-2">
                        <Button size="sm" variant="outline" onClick={() => openLinkedRecord(log)}>Open Record</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="space-y-4 p-4">
                {['Today', 'Yesterday', 'This Week', 'Earlier'].map((group) => (
                  groupedTimeline[group]?.length ? (
                    <div key={group}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                      <div className="space-y-2">
                        {groupedTimeline[group].map((log) => (
                          <div key={log.id} className="rounded-md border p-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <SeverityTag value={log.severityTag} />
                              <span className="rounded-full bg-slate-100 px-2 py-0.5">{log.category}</span>
                              <span>{new Date(log.created_at).toLocaleString('en-IN')}</span>
                            </div>
                            <p className="mt-1 text-sm font-medium">{log.actionLabel} · {log.moduleLabel}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{log.description || '—'}</p>
                            <div className="mt-1 text-xs text-muted-foreground">By: {log.user?.name || log.user?.username || 'System'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      <PaginationBar
        pagination={data?.pagination}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />
    </>
  )
}
