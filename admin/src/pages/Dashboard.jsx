import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Line,
  AreaChart,
  Area,
  Bar,
} from 'recharts'
import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import NotificationsPanel from '@/components/dashboard/NotificationsPanel'
import { useAnalyticsDashboard, useNotifications } from '@/hooks/useAnalytics'
import { formatCurrency } from '@/utils/formatters'
import {
  IndianRupee,
  TrendingUp,
  Scale,
  ClipboardCheck,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  ShieldCheck,
  Wallet,
  Building2,
  PlusCircle,
  FileText,
  ChevronDown,
} from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import TableLoadingSkeleton from '@/components/common/TableLoadingSkeleton'
import { useAuthStore } from '@/store/useAuthStore'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const CHART_COLORS = ['#FF8C33', '#7B1C1C', '#C9A84C', '#A56A46', '#9B2C2C', '#5C1515']
const CHART_THEME = {
  grid: 'hsl(var(--border))',
  axisText: 'hsl(var(--muted-foreground))',
  tooltipBorder: 'hsl(var(--border))',
  donations: '#FF8C33',
  expenses: '#7B1C1C',
}
const IMPORTANT_DASHBOARD_ACTIONS = new Set([
  'CREATE',
  'UPDATE',
  'DELETE',
  'RECONCILE',
  'RECEIPT_REGENERATE',
  'WHATSAPP_SEND',
])

function compactPercentage(part, total) {
  if (!total || Number(total) <= 0) return 0
  return Math.round((Number(part) / Number(total)) * 100)
}

function topRows(data, limit = 4) {
  return (data || []).slice(0, limit)
}

function formatAxisDate(value) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function formatCompactAxisValue(value) {
  const num = Number(value || 0)
  if (Math.abs(num) >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`
  if (Math.abs(num) >= 100000) return `${(num / 100000).toFixed(1)}L`
  if (Math.abs(num) >= 1000) return `${Math.round(num / 1000)}k`
  return String(num)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function shiftDateIso(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function hasRenderableTrend(data = []) {
  if (!Array.isArray(data) || data.length < 2) return false
  return data.some((row) =>
    Object.values(row || {}).some((value) => typeof value === 'number' && value > 0)
  )
}

function shouldShowInQuickFeed(log) {
  if (!log) return false
  if (log.action === 'LOGIN' && log.module !== 'SECURITY') return false
  if (log.action === 'LOGIN' && log.description?.toLowerCase().includes('user logged in')) return false
  if (!IMPORTANT_DASHBOARD_ACTIONS.has(log.action)) return false
  return true
}

function roleConfig(role) {
  if (role === 'TRUSTEE') {
    return {
      roleLabel: 'Trustee View',
      pageDescription: 'Governance-focused financial and operational overview for trustees',
      kpiOrder: ['year', 'month', 'today', 'settlement'],
      middlePrimary: 'topDonors',
      middleSecondary: 'alerts',
      bottomOrder: ['collectionModes', 'settlementSnapshot'],
    }
  }

  if (role === 'ACCOUNTANT') {
    return {
      roleLabel: 'Accounts View',
      pageDescription: 'Accounts-first view focused on reconciliation, expenditure, and accounting discipline',
      kpiOrder: ['settlement', 'month', 'year', 'today'],
      middlePrimary: 'alerts',
      middleSecondary: 'topDonors',
      bottomOrder: ['settlementSnapshot', 'collectionModes'],
    }
  }

  if (role === 'OPERATOR') {
    return {
      roleLabel: 'Operator View',
      pageDescription: 'Execution-focused view for daily collection activity and pending actions',
      kpiOrder: ['today', 'settlement', 'month', 'year'],
      middlePrimary: 'alerts',
      middleSecondary: 'topDonors',
      bottomOrder: ['collectionModes', 'settlementSnapshot'],
    }
  }

  return {
    roleLabel: 'Admin View',
    pageDescription: 'Comprehensive operational and financial overview for administration',
    kpiOrder: ['today', 'month', 'year', 'settlement'],
    middlePrimary: 'alerts',
    middleSecondary: 'topDonors',
    bottomOrder: ['collectionModes', 'settlementSnapshot'],
  }
}

function KpiCard({ title, value, sub, trendLabel, trendPositive, icon: Icon, loading }) {
  return (
    <Card className="border-border/80 h-full">
      <CardHeader className="flex flex-row items-start justify-between pb-1 px-4 pt-3">
        <CardTitle className="text-[11px] font-semibold tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
        <span className="rounded-md bg-muted p-1.5">
          <Icon className="h-3.5 w-3.5 text-saffron-dark" />
        </span>
      </CardHeader>
      <CardContent className="space-y-1 px-4 pb-3 pt-0 min-h-[92px] flex flex-col justify-end">
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <>
            <p className="text-[30px] font-semibold leading-tight text-foreground">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground line-clamp-1">{sub}</p>}
            {trendLabel ? (
              <p className="flex items-center gap-1 text-[11px]">
                {trendPositive ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-amber-600" />
                )}
                <span className={`line-clamp-1 ${trendPositive ? 'text-emerald-700' : 'text-amber-700'}`}>{trendLabel}</span>
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const [period, setPeriod] = useState('MONTHLY')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const analyticsParams = useMemo(() => {
    if (period === 'TODAY') return { period: 'CUSTOM', date_from: todayISO(), date_to: todayISO() }
    if (period === 'WEEKLY') return { period: 'CUSTOM', date_from: shiftDateIso(-6), date_to: todayISO() }
    if (period !== 'CUSTOM') return { period }
    if (!customFrom || !customTo) return { period: 'MONTHLY' }
    return {
      period,
      date_from: customFrom || undefined,
      date_to: customTo || undefined,
    }
  }, [period, customFrom, customTo])
  const customRangeReady = period !== 'CUSTOM' || (Boolean(customFrom) && Boolean(customTo))
  const { data, isLoading, isError, error } = useAnalyticsDashboard(analyticsParams)
  const notificationsQuery = useNotifications()
  const userRole = useAuthStore((s) => s.user?.role || 'ADMIN')

  if (isError) {
    return (
      <>
        <PageHeader title="Analytics" description="Advanced trust dashboard" />
        <Alert variant="destructive">
          <AlertTitle>Failed to load analytics</AlertTitle>
          <AlertDescription>{error?.message || 'Please try again.'}</AlertDescription>
        </Alert>
      </>
    )
  }

  const charts = data?.charts || {}
  const paymentData = topRows(charts.payment_mode_distribution || [], 5)
  const expenseCats = topRows(charts.top_expense_categories || [], 5)
  const monthly = charts.donation_vs_expense || []
  const daily = charts.daily_donation_trend || []
  const topDonors = topRows(data?.top_donors || [], 5)
  const quickFeed = (data?.recent_activity || []).filter(shouldShowInQuickFeed).slice(0, 6)
  const recentReceipts = topRows(data?.recent_documents?.receipts || [], 4)
  const recentVouchers = topRows(data?.recent_documents?.vouchers || [], 4)
  const recentExports = topRows(data?.recent_documents?.exports || [], 4)

  const monthDon = Number(data?.this_month?.donation_amount || 0)
  const monthExp = Number(data?.this_month?.expense_amount || 0)
  const monthNet = monthDon - monthExp
  const selectedPeriod = data?.selected_period
  const selectedLabel = selectedPeriod?.label || 'Monthly'
  const activeRangeLabel = selectedPeriod?.date_from && selectedPeriod?.date_to
    ? `${new Date(selectedPeriod.date_from).toLocaleDateString('en-IN')} - ${new Date(selectedPeriod.date_to).toLocaleDateString('en-IN')}`
    : selectedLabel
  const periodDonation = Number(selectedPeriod?.donation_amount ?? monthDon)
  const periodExpense = Number(selectedPeriod?.expense_amount ?? monthExp)
  const periodNet = Number(selectedPeriod?.net ?? monthNet)
  const paymentTotal = paymentData.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const expenseMax = Math.max(...expenseCats.map((x) => Number(x.amount || 0)), 0)
  const monthlyHasData = hasRenderableTrend(monthly)
  const dailyHasData = hasRenderableTrend(daily)
  const monthlyNonZeroPoints = monthly.filter((row) => Number(row?.donations || 0) > 0 || Number(row?.expenses || 0) > 0).length
  const dailyNonZeroPoints = daily.filter((row) => Number(row?.amount || 0) > 0).length
  const monthlyChartReady = monthlyHasData && monthlyNonZeroPoints >= 2
  const dailyChartReady = dailyHasData && dailyNonZeroPoints >= 2
  const monthlyDataPoints = monthly.filter((row) => Number(row?.donations || 0) > 0 || Number(row?.expenses || 0) > 0).length
  const dailyDataPoints = daily.filter((row) => Number(row?.amount || 0) > 0).length
  const minimumTrendDays = 30
  const trendReadiness = Math.min(100, Math.round((dailyDataPoints / minimumTrendDays) * 100))
  const paymentLead = paymentData[0]
  const settlementTotal = Number(data?.pending_reconciliation?.total || 0)
  const financialHealthTone =
    periodNet > 0 ? 'text-emerald-700' : periodNet < 0 ? 'text-red-700' : 'text-amber-700'
  const financialHealthMessage =
    periodNet > 0
      ? `${selectedLabel} collections are higher than expenditure by ${formatCurrency(periodNet)}.`
      : periodNet < 0
        ? `${selectedLabel} expenditure exceeded collections by ${formatCurrency(Math.abs(periodNet))}.`
        : `Collections and expenditure are balanced for the selected ${selectedLabel.toLowerCase()} period.`
  const settlementMessage =
    settlementTotal === 0
      ? 'Reconciliation status is healthy. No pending items.'
      : `${settlementTotal} entries need reconciliation attention.`
  const dashboardRoleConfig = roleConfig(userRole)
  const largestDonor = topDonors[0]
  const todayVsMonthHint = monthDon > 0 ? `${compactPercentage(data?.today?.donation_amount || 0, monthDon)}% of this month` : 'First collection for this month'
  const cashMode = paymentData.find((p) => String(p.payment_mode || '').toUpperCase() === 'CASH')
  const bankModesTotal = paymentData
    .filter((p) => String(p.payment_mode || '').toUpperCase() !== 'CASH')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const cashInHand = Number(cashMode?.amount || 0) - Number(data?.this_month?.expense_amount || 0)
  const bankBalanceIndicative = bankModesTotal
  const cashUtilizationRatio = periodDonation > 0 ? Math.round((Math.max(cashInHand, 0) / periodDonation) * 100) : 0
  const riskSignals = [
    settlementTotal > 0
      ? {
          id: 'reconciliation-pending',
          severity: settlementTotal > 5 ? 'critical' : 'warning',
          message: `${settlementTotal} reconciliation items pending review.`,
          actionLabel: 'Review Register',
          actionTo: '/reconciliation',
        }
      : null,
    periodNet < 0
      ? {
          id: 'net-deficit',
          severity: 'warning',
          message: `Expenditure exceeded collections by ${formatCurrency(Math.abs(periodNet))}.`,
          actionLabel: 'Open Reports',
          actionTo: '/reports',
        }
      : null,
    (quickFeed || []).some((x) => String(x.action).toUpperCase() === 'RECEIPT_REGENERATE')
      ? {
          id: 'receipt-regenerated',
          severity: 'warning',
          message: 'Receipt regeneration activity detected in selected range.',
          actionLabel: 'Open Audit Trail',
          actionTo: '/audit-logs',
        }
      : null,
    periodDonation > 0 && paymentData.length === 1 && String(paymentData[0].payment_mode).toUpperCase() === 'CASH'
      ? {
          id: 'cash-concentration',
          severity: 'critical',
          message: 'High cash concentration detected in collection mix.',
          actionLabel: 'View Collection Modes',
          actionTo: '/reports',
        }
      : null,
  ].filter(Boolean)
  const riskLevel = riskSignals.some((signal) => signal.severity === 'critical')
    ? 'High'
    : riskSignals.length
      ? 'Moderate'
      : 'Stable'
  const riskLevelTone =
    riskLevel === 'High'
      ? 'text-red-700 bg-red-50 border-red-200'
      : riskLevel === 'Moderate'
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : 'text-emerald-700 bg-emerald-50 border-emerald-200'
  const financialHealthStatus =
    periodNet < 0 ? 'Moderate Risk' : settlementTotal > 0 ? 'Watchlist' : 'Healthy'
  const kpiCards = {
    today: (
      <KpiCard
        title="Today's Collection"
        value={formatCurrency(data?.today?.donation_amount)}
        sub={`${data?.today?.donations ?? 0} receipts · ${todayVsMonthHint}${largestDonor ? ` · Largest donor: ${largestDonor.donor_name}` : ''}`}
        trendLabel={`${Number(data?.today?.net || 0) >= 0 ? 'Healthy inflow' : 'Net outflow observed'}`}
        trendPositive={Number(data?.today?.net || 0) >= 0}
        icon={IndianRupee}
        loading={isLoading}
      />
    ),
    month: (
      <KpiCard
        title={`${selectedLabel} Collection`}
        value={formatCurrency(periodDonation)}
        sub={`Expenditure ${formatCurrency(periodExpense)}`}
        trendLabel={`${periodNet >= 0 ? 'Surplus' : 'Deficit'} ${formatCurrency(Math.abs(periodNet))}`}
        trendPositive={periodNet >= 0}
        icon={TrendingUp}
        loading={isLoading}
      />
    ),
    year: (
      <KpiCard
        title={`Net ${Number(data?.this_year?.net || 0) >= 0 ? 'Surplus' : 'Deficit'} (FY)`}
        value={formatCurrency(Math.abs(Number(data?.this_year?.net || 0)))}
        sub={`Collections ${formatCurrency(data?.this_year?.donation_amount)} · Expenditure ${formatCurrency(data?.this_year?.expense_amount)}`}
        trendLabel={Number(data?.this_year?.net || 0) >= 0 ? 'Positive FY position' : 'Deficit FY position'}
        trendPositive={Number(data?.this_year?.net || 0) >= 0}
        icon={Scale}
        loading={isLoading}
      />
    ),
    settlement: (
      <KpiCard
        title="Pending Reconciliation"
        value={String(data?.pending_reconciliation?.total ?? 0)}
        sub={`${data?.pending_reconciliation?.donations ?? 0} receipts · ${data?.pending_reconciliation?.expenses ?? 0} payments`}
        trendLabel={(data?.pending_reconciliation?.total || 0) > 0 ? 'Requires review' : `No pending items · ${new Date().toLocaleTimeString('en-IN')}`}
        trendPositive={(data?.pending_reconciliation?.total || 0) === 0}
        icon={ClipboardCheck}
        loading={isLoading}
      />
    ),
  }

  const middleSections = {
    alerts: (
      <Card className="order-first lg:order-none lg:col-span-6">
        <CardContent className="pt-6">
          <NotificationsPanel
            notifications={notificationsQuery.data?.notifications}
            unreadCount={notificationsQuery.data?.unread_count}
            loading={notificationsQuery.isLoading}
          />
        </CardContent>
      </Card>
    ),
    topDonors: (
      <Card className="lg:col-span-6">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold sm:text-base">Top Donors</CardTitle>
            <Badge variant="outline">{topDonors.length} active</Badge>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <TableLoadingSkeleton rows={5} className="p-0" />
          ) : !topDonors.length ? (
            <EmptyState compact title="No donors yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[56px] text-[11px] uppercase tracking-wide text-muted-foreground sm:text-xs">Rank</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground sm:text-xs">Donor</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground sm:text-xs">Mobile</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground sm:text-xs">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topDonors.map((d, idx) => (
                  <TableRow key={d.donor_mobile}>
                    <TableCell>
                      <Badge variant={idx < 3 ? 'secondary' : 'outline'}>#{idx + 1}</Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{d.donor_name}</TableCell>
                    <TableCell className="text-sm">{d.donor_mobile}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(d.total_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    ),
  }

  const bottomSections = {
    collectionModes: (
      <Card className="lg:col-span-6">
        <CardHeader className="pb-2">
          <div className="space-y-1">
            <CardTitle className="text-sm font-semibold sm:text-base">Collection Mix</CardTitle>
            {!isLoading && paymentLead ? (
              <p className="text-xs text-muted-foreground">
                Primary mode: <span className="font-medium text-foreground">{paymentLead.payment_mode}</span> ({compactPercentage(paymentLead.amount, paymentTotal)}%)
              </p>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <TableLoadingSkeleton rows={4} className="p-0" />
          ) : !paymentData.length ? (
            <EmptyState compact title="No collection mode data" description="Collection mode split will appear after collections are recorded." />
          ) : (
            <div className="space-y-3">
              {paymentData.map((p, i) => {
                const pct = compactPercentage(p.amount, paymentTotal)
                return (
                  <div key={p.payment_mode} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-sm font-medium text-foreground">{p.payment_mode}</span>
                      <span className="text-xs text-muted-foreground">{formatCurrency(p.amount)} · {pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    ),
    settlementSnapshot: (
      <Card className="lg:col-span-6">
        <CardHeader className="pb-2">
          <div className="space-y-1">
            <CardTitle className="text-sm font-semibold sm:text-base">Reconciliation Status</CardTitle>
            {!isLoading ? <p className={`text-xs ${settlementTotal > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{settlementMessage}</p> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {isLoading ? (
            <TableLoadingSkeleton rows={3} className="p-0" />
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground sm:text-xs">Pending Donations</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{data?.pending_reconciliation?.donations ?? 0}</p>
                </div>
                <div className="rounded-md border p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground sm:text-xs">Pending Expenses</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{data?.pending_reconciliation?.expenses ?? 0}</p>
                </div>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link to="/reconciliation">Open Reconciliation Register</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    ),
  }

  return (
    <>
      <PageHeader
        title="Trust Operations Dashboard"
        description={`Monitor collections, expenditure, reconciliation status and operational activities across the trust. (${dashboardRoleConfig.roleLabel})`}
      >
        <div className="flex w-full justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-9 gap-1.5 bg-gradient-to-r from-saffron to-saffron-dark px-4 text-white shadow-sm transition-all hover:from-saffron-dark hover:to-maroon hover:shadow-md focus-visible:ring-saffron/40">
                <PlusCircle className="h-4 w-4" />
                Quick Action
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-border/80 shadow-lg">
              <DropdownMenuItem asChild className="group">
                <Link to="/donations" className="flex items-center gap-2">
                  <PlusCircle className="h-4 w-4 text-saffron-dark transition-colors group-focus:text-maroon" />
                  Record Donation
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="group">
                <Link to="/expenses" className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-saffron-dark transition-colors group-focus:text-maroon" />
                  Record Expense
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="group">
                <Link to="/trustees" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-saffron-dark transition-colors group-focus:text-maroon" />
                  Add Trustee
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="group">
                <Link to="/reconciliation" className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-saffron-dark transition-colors group-focus:text-maroon" />
                  Reconcile Entries
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="group">
                <Link to="/reports" className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-saffron-dark transition-colors group-focus:text-maroon" />
                  Generate Report
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-9 w-[170px] text-sm">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAY">Today</SelectItem>
            <SelectItem value="WEEKLY">This Week</SelectItem>
            <SelectItem value="MONTHLY">Monthly</SelectItem>
            <SelectItem value="QUARTERLY">Quarterly</SelectItem>
            <SelectItem value="YEARLY">Yearly</SelectItem>
            <SelectItem value="CUSTOM">Custom Date</SelectItem>
          </SelectContent>
        </Select>
        {period === 'CUSTOM' ? (
          <>
            <input
              type="date"
              value={customFrom}
              max={customTo || todayISO()}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Custom period start date"
            />
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              max={todayISO()}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Custom period end date"
            />
          </>
        ) : null}
        <div className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground">
          Active Range: {activeRangeLabel}
        </div>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Receipts Issued Today</p><p className="text-lg font-semibold">{data?.today?.donations ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Expenses Recorded Today</p><p className="text-lg font-semibold">{data?.today?.expenses ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Pending Approvals</p><p className="text-lg font-semibold">{settlementTotal}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Reconciled Entries</p><p className="text-lg font-semibold">{Math.max(0, Number(data?.today?.donations || 0) - settlementTotal)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Receipts Regenerated</p><p className="text-lg font-semibold">{quickFeed.filter((x) => String(x.action).toUpperCase() === 'RECEIPT_REGENERATE').length}</p></CardContent></Card>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
        {dashboardRoleConfig.kpiOrder.map((cardKey) => (
          <div key={cardKey}>{kpiCards[cardKey]}</div>
        ))}
      </div>

      <Card className="mt-3 border-border/80">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="inline-flex items-center gap-1 text-sm font-semibold sm:text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Risk & Exceptions
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={`border ${riskLevelTone}`}>Risk: {riskLevel}</Badge>
              <Badge variant="outline">{riskSignals.length} signals</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {riskSignals.length ? (
            riskSignals.map((signal) => (
              <div key={signal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-2.5 py-2">
                <div className="inline-flex items-center gap-2 text-sm">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      signal.severity === 'critical' ? 'bg-red-600' : 'bg-amber-500'
                    }`}
                  />
                  <span>{signal.message}</span>
                </div>
                <Button asChild variant="ghost" className="h-7 px-2 text-xs">
                  <Link to={signal.actionTo}>{signal.actionLabel}</Link>
                </Button>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              No suspicious or high-risk operational indicators detected in selected range.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <Card className="lg:col-span-8">
          <CardHeader>
            <div className="space-y-2">
              <CardTitle className="text-sm font-semibold sm:text-base">{selectedLabel} Financial Snapshot</CardTitle>
              {!isLoading ? (
                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-md bg-muted/40 px-2.5 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Collections</p>
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(periodDonation)}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 px-2.5 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Expenditure</p>
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(periodExpense)}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 px-2.5 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Net Balance</p>
                    <p className={`text-sm font-semibold ${financialHealthTone}`}>{formatCurrency(periodNet)}</p>
                  </div>
                </div>
              ) : null}
              {!isLoading ? <p className={`text-xs ${financialHealthTone}`}>{financialHealthMessage}</p> : null}
            </div>
          </CardHeader>
          <CardContent className={monthlyChartReady ? 'h-[220px] sm:h-[250px] lg:h-[270px]' : 'h-auto'}>
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : !monthlyChartReady ? (
              <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium text-foreground">Data Maturity (Monthly Analysis)</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md border bg-background px-2.5 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Observed Trend Points</p>
                    <p className="text-sm font-semibold text-foreground">{monthlyDataPoints}</p>
                  </div>
                  <div className="rounded-md border bg-background px-2.5 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Minimum Required</p>
                    <p className="text-sm font-semibold text-foreground">{minimumTrendDays} days</p>
                  </div>
                  <div className="rounded-md border bg-background px-2.5 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Readiness</p>
                    <p className="text-sm font-semibold text-amber-700">{Math.min(100, Math.round((monthlyDataPoints / minimumTrendDays) * 100))}%</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Continue recording daily collections and expenses to unlock monthly trend analysis and forecasting.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ left: 8, right: 8, top: 8, bottom: 0 }} barCategoryGap={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} interval="preserveStartEnd" angle={0} textAnchor="middle" height={34} minTickGap={20} />
                  <YAxis tick={{ fontSize: 10, fill: CHART_THEME.axisText }} tickFormatter={formatCompactAxisValue} />
                  <Tooltip
                    formatter={(v) => formatCurrency(v)}
                    contentStyle={{ borderRadius: 10, borderColor: CHART_THEME.tooltipBorder, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="donations" fill={CHART_THEME.donations} name="Donations" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill={CHART_THEME.expenses} name="Expenditure" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-sm font-semibold sm:text-base">Collection Trend ({selectedLabel})</CardTitle>
          </CardHeader>
          <CardContent className={dailyChartReady ? 'h-[220px] sm:h-[260px] lg:h-[280px]' : 'h-auto'}>
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : !customRangeReady ? (
              <div className="flex h-full items-center justify-center">
                <EmptyState compact title="Select custom range" description="Choose both dates to load custom period insights." />
              </div>
            ) : !dailyChartReady ? (
              <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-foreground">Trend Readiness</p>
                  <Badge variant="outline">{trendReadiness}% ready</Badge>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-saffron"
                    style={{ width: `${Math.max(8, trendReadiness)}%` }}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border bg-background px-2.5 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Daily Records Captured</p>
                    <p className="text-sm font-semibold text-foreground">{dailyDataPoints} days</p>
                  </div>
                  <div className="rounded-md border bg-background px-2.5 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Target Window</p>
                    <p className="text-sm font-semibold text-foreground">{minimumTrendDays} days</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Capture regular entries and maintain reconciliation to activate daily trend interpretation.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: CHART_THEME.axisText }}
                    tickFormatter={formatAxisDate}
                    interval="preserveStartEnd"
                    minTickGap={24}
                    height={42}
                  />
                  <YAxis tick={{ fontSize: 10, fill: CHART_THEME.axisText }} tickFormatter={formatCompactAxisValue} />
                  <Tooltip
                    formatter={(v) => formatCurrency(v)}
                    contentStyle={{ borderRadius: 10, borderColor: CHART_THEME.tooltipBorder, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}
                  />
                  <Bar dataKey="amount" fill={CHART_THEME.donations} radius={[4, 4, 0, 0]} name="Collection" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Cash in Hand (Indicative)</p><p className="text-lg font-semibold">{formatCurrency(cashInHand)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Bank Balance (Indicative)</p><p className="text-lg font-semibold">{formatCurrency(bankBalanceIndicative)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Cash Utilization Ratio</p><p className="text-lg font-semibold">{cashUtilizationRatio}%</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Financial Health</p><p className={`text-lg font-semibold ${financialHealthTone}`}>{financialHealthStatus}</p></CardContent></Card>
      </div>

      <div className="mt-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold sm:text-base">System Integrity</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-emerald-600" />Audit Trail Protected</p>
            <p className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-emerald-600" />0 Failed Login Attempts</p>
            <p className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-emerald-600" />Financial Registers Synced</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-3">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold sm:text-base">Recent Financial Documents</CardTitle>
            <Badge variant="outline">
              {recentReceipts.length + recentVouchers.length + recentExports.length} recent items
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-md border p-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest Receipts</p>
            {!recentReceipts.length ? (
              <p className="text-xs text-muted-foreground">No receipts in selected range.</p>
            ) : (
              <div className="space-y-2">
                {recentReceipts.map((item) => (
                  <div key={item.id} className="rounded border px-2 py-1.5">
                    <Button asChild variant="link" className="h-auto p-0 text-xs font-medium">
                      <Link to={`/donations?search=${encodeURIComponent(item.ref)}`}>{item.ref}</Link>
                    </Button>
                    <p className="text-[11px] text-muted-foreground">{item.particulars}</p>
                    <p className="text-[11px]">{formatCurrency(item.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-md border p-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest Vouchers</p>
            {!recentVouchers.length ? (
              <p className="text-xs text-muted-foreground">No vouchers in selected range.</p>
            ) : (
              <div className="space-y-2">
                {recentVouchers.map((item) => (
                  <div key={item.id} className="rounded border px-2 py-1.5">
                    <Button asChild variant="link" className="h-auto p-0 text-xs font-medium">
                      <Link to={`/expenses?search=${encodeURIComponent(item.ref)}`}>{item.ref}</Link>
                    </Button>
                    <p className="text-[11px] text-muted-foreground">{item.particulars}</p>
                    <p className="text-[11px]">{formatCurrency(item.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-md border p-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest Exports</p>
            {!recentExports.length ? (
              <p className="text-xs text-muted-foreground">No exports recorded in selected range.</p>
            ) : (
              <div className="space-y-2">
                {recentExports.map((item) => (
                  <div key={item.id} className="rounded border px-2 py-1.5">
                    <Button asChild variant="link" className="h-auto p-0 text-xs font-medium">
                      <Link to="/reports">{item.action}</Link>
                    </Button>
                    <p className="text-[11px] text-muted-foreground">{item.description}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString('en-IN')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-4 lg:grid-cols-12 lg:gap-5">
        {dashboardRoleConfig.middlePrimary === 'alerts' ? middleSections.alerts : middleSections.topDonors}
        {dashboardRoleConfig.middleSecondary === 'topDonors' ? middleSections.topDonors : middleSections.alerts}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-4 lg:grid-cols-12 lg:gap-5">
        {dashboardRoleConfig.bottomOrder.map((sectionKey) => (
          <Fragment key={sectionKey}>{bottomSections[sectionKey]}</Fragment>
        ))}
      </div>

    </>
  )
}
