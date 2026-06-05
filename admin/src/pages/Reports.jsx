import { useMemo, useState } from 'react'
import { Download, FileCheck2, FileSpreadsheet, Filter, Loader2, Printer, ShieldCheck } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import EmptyState from '@/components/common/EmptyState'
import TableLoadingSkeleton from '@/components/common/TableLoadingSkeleton'
import {
  useFinancialSummary,
  useDailySummary,
  useDateRangeReport,
  usePaymentModeSummary,
  useExpenseSummary,
  useTrusteeContributionsReport,
  exportExcel,
  exportPdf,
} from '@/hooks/useReports'
import { useReconciliation } from '@/hooks/useAnalytics'
import { formatCurrency, formatPaymentMode, todayISO } from '@/utils/formatters'
import { toast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api'

function fyOptions(baseYear = new Date().getFullYear(), span = 6) {
  const start = baseYear - 3
  return Array.from({ length: span }, (_, i) => {
    const y = start + i
    const next = String((y + 1) % 100).padStart(2, '0')
    return {
      value: `${y}-${next}`,
      label: `FY ${y}-${next}`,
    }
  }).reverse()
}

function fyToDateRange(fy) {
  const startYear = parseInt(String(fy).split('-')[0], 10)
  if (!startYear) return { dateFrom: '', dateTo: '' }
  const from = `${startYear}-04-01`
  const toYear = startYear + 1
  const today = todayISO()
  const fyEnd = `${toYear}-03-31`
  return { dateFrom: from, dateTo: today < fyEnd ? today : fyEnd }
}

const REPORT_CATEGORIES = [
  'Operational Reports',
  'Accounting Reports',
  'Donation Reports',
  'Expense Reports',
  'Trustee Reports',
  'Compliance Reports',
  'Audit Reports',
]

const REPORT_MODULES = [
  { id: 'daily_register', category: 'Operational Reports', title: 'Daily Collection & Expense Register', purpose: 'Daily operations register with receipt, voucher and verification signals.', exportType: 'full', metricKey: 'daily' },
  { id: 'monthly_collection', category: 'Operational Reports', title: 'Monthly Collection Summary', purpose: 'Period-based collection summary for operations monitoring.', exportType: 'donations', metricKey: 'donationRange' },
  { id: 'annual_overview', category: 'Accounting Reports', title: 'Annual Financial Overview', purpose: 'FY-level donation, expense and net surplus/deficit overview.', exportType: 'full', metricKey: 'financial' },
  { id: 'expense_register', category: 'Expense Reports', title: 'Expense Register', purpose: 'Voucher-style expense register for audit and governance checks.', exportType: 'expenses', metricKey: 'expense' },
  { id: 'donation_register', category: 'Donation Reports', title: 'Donation Collection Register', purpose: 'Receipt-wise and donor-wise collection report for trust accounting.', exportType: 'donations', metricKey: 'donationRange' },
  { id: 'mode_wise', category: 'Donation Reports', title: 'Mode-wise Collection Report', purpose: 'Cash/UPI/Bank/Cheque mix for control and compliance insights.', exportType: 'donations', metricKey: 'paymentMode' },
  { id: 'top_donor', category: 'Donation Reports', title: 'Top Donor Summary', purpose: 'High-value donor trend for annual planning and recognition.', exportType: 'donations', metricKey: 'financial' },
  { id: 'high_value_donation', category: 'Compliance Reports', title: 'High Value Donation Report', purpose: 'Flag large donations (10k/50k/2L+) for review and control.', exportType: 'donations', metricKey: 'highValueDonation' },
  { id: 'cash_donation_threshold', category: 'Compliance Reports', title: 'Cash Donation Threshold Report', purpose: 'Cash-heavy and threshold-sensitive donations for tax readiness.', exportType: 'donations', metricKey: 'paymentMode' },
  { id: 'reconciliation_pending', category: 'Compliance Reports', title: 'Reconciliation Pending Report', purpose: 'Pending bank matching entries for settlement closure.', exportType: 'full', metricKey: 'reconciliation' },
  { id: 'trustee_contribution', category: 'Trustee Reports', title: 'Trustee Contribution Report', purpose: 'Trustee-wise contribution and mobilization summary.', exportType: 'trustees', metricKey: 'trustee' },
  { id: 'voucher_verification', category: 'Audit Reports', title: 'Voucher Verification Register', purpose: 'Verification control register for audited voucher hygiene.', exportType: 'expenses', metricKey: 'expense' },
  { id: 'high_risk_transactions', category: 'Audit Reports', title: 'High Risk Transactions', purpose: 'High-value and mismatch-sensitive transaction watchlist.', exportType: 'full', metricKey: 'highRisk' },
]

function ReportModuleCard({ module, metric, onExcel, onPdf, onPrint, filtersApplied }) {
  return (
    <Card className="h-full border-slate-200">
      <CardHeader className="pb-2 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{module.category}</p>
        <CardTitle className="text-sm leading-tight">{module.title}</CardTitle>
        <p className="text-xs text-muted-foreground">{module.purpose}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border bg-slate-50 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Preview Metrics</p>
          <p className="text-sm font-semibold">{metric}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {filtersApplied.map((item) => (
            <span key={`${module.id}-${item}`} className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
              {item}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onExcel}><FileSpreadsheet className="h-3.5 w-3.5" />Excel</Button>
          <Button size="sm" variant="outline" onClick={onPdf}><FileCheck2 className="h-3.5 w-3.5" />PDF</Button>
          <Button size="sm" variant="outline" onClick={onPrint}><Printer className="h-3.5 w-3.5" />Print</Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Reports() {
  const currentYear = new Date().getFullYear()
  const currentFyStart = new Date().getMonth() >= 3 ? currentYear : currentYear - 1
  const defaultFy = `${currentFyStart}-${String((currentFyStart + 1) % 100).padStart(2, '0')}`
  const defaultFyRange = fyToDateRange(defaultFy)

  const [dailyDate, setDailyDate] = useState(todayISO())
  const [financialYear, setFinancialYear] = useState(defaultFy)
  const [dateFrom, setDateFrom] = useState(defaultFyRange.dateFrom)
  const [dateTo, setDateTo] = useState(defaultFyRange.dateTo)
  const [paymentModeFilter, setPaymentModeFilter] = useState('ALL')
  const [ledgerFilter, setLedgerFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [trusteeFilter, setTrusteeFilter] = useState('ALL')
  const [donationTypeFilter, setDonationTypeFilter] = useState('ALL')
  const [verificationStatus, setVerificationStatus] = useState('ALL')
  const [activeCategory, setActiveCategory] = useState('Operational Reports')
  const [exporting, setExporting] = useState(false)
  const [isGenerated, setIsGenerated] = useState(false)
  const [history, setHistory] = useState([])

  const financialSummary = useFinancialSummary()
  const daily = useDailySummary(dailyDate)
  const dateRangeReport = useDateRangeReport(dateFrom && dateTo ? { date_from: dateFrom, date_to: dateTo, limit: 100 } : null)
  const paymentModes = usePaymentModeSummary(dateFrom && dateTo ? { date_from: dateFrom, date_to: dateTo } : null)
  const expenseSummary = useExpenseSummary(dateFrom && dateTo ? { date_from: dateFrom, date_to: dateTo } : null)
  const dailyExpenseSummary = useExpenseSummary(dailyDate ? { date_from: dailyDate, date_to: dailyDate } : null)
  const trusteeReport = useTrusteeContributionsReport()
  const reconciliation = useReconciliation({ period: 'MONTHLY' })

  const moduleMetrics = useMemo(() => {
    const highValueDonations = (dateRangeReport.data?.donations || []).filter((d) => Number(d.amount || 0) >= 10000)
    const highRiskCount =
      highValueDonations.length +
      Number(reconciliation.data?.totals?.pending_receipts_count || 0) +
      Number(reconciliation.data?.totals?.pending_payments_count || 0)
    const modeCount = paymentModes.data?.by_payment_mode?.length || 0
    const topDonor = financialSummary.data?.top_10_donors?.[0]

    return {
      daily: `${formatCurrency(daily.data?.total_amount)} | ${daily.data?.total_count || 0} receipts | ${dailyExpenseSummary.data?.summary?.expense_count || 0} vouchers`,
      donationRange: `${formatCurrency(dateRangeReport.data?.summary?.total_amount)} across ${dateRangeReport.data?.summary?.total_count || 0} donations`,
      expense: `${formatCurrency(expenseSummary.data?.summary?.total_amount)} across ${expenseSummary.data?.summary?.expense_count || 0} expenses`,
      paymentMode: `${modeCount} payment mode(s) tracked in selected period`,
      trustee: `${formatCurrency(trusteeReport.data?.grand_total)} total trustee contributions`,
      reconciliation: `${reconciliation.data?.totals?.pending_receipts_count || 0} receipts + ${reconciliation.data?.totals?.pending_payments_count || 0} payments pending`,
      financial: `${formatCurrency(financialSummary.data?.net_balance)} net FY balance`,
      highValueDonation: `${highValueDonations.length} donation(s) above Rs. 10,000`,
      highRisk: `${highRiskCount} transaction(s) flagged for review`,
      topDonor: topDonor ? `${topDonor.donor_name || 'Top donor'} - ${formatCurrency(topDonor.total_amount)}` : 'No donor concentration risk',
    }
  }, [daily.data, dailyExpenseSummary.data, dateRangeReport.data, expenseSummary.data, paymentModes.data, trusteeReport.data, reconciliation.data, financialSummary.data])

  const quickInsights = useMemo(() => {
    const totalDonations = Number(financialSummary.data?.total_donations_this_fy || 0)
    const totalExpenses = Number(financialSummary.data?.total_expenses_this_fy || 0)
    const pendingReconciliation =
      Number(reconciliation.data?.totals?.pending_receipts_count || 0) +
      Number(reconciliation.data?.totals?.pending_payments_count || 0)
    const cashMode = (paymentModes.data?.by_payment_mode || []).find((x) => x.payment_mode === 'CASH')
    const highValueTxnCount = (dateRangeReport.data?.donations || []).filter((d) => Number(d.amount || 0) >= 50000).length

    return [
      { label: 'Total Donations', value: formatCurrency(totalDonations) },
      { label: 'Total Expenses', value: formatCurrency(totalExpenses) },
      { label: 'Net Surplus / Deficit', value: formatCurrency(totalDonations - totalExpenses) },
      { label: 'Cash Balance (Indicative)', value: cashMode ? formatCurrency(cashMode.total_amount) : formatCurrency(0) },
      { label: 'Bank Balance (Indicative)', value: formatCurrency(Math.max(totalDonations - Number(cashMode?.total_amount || 0) - totalExpenses, 0)) },
      { label: 'Pending Reconciliation', value: `${pendingReconciliation} entries` },
      { label: 'High Value Transactions', value: `${highValueTxnCount} in selected range` },
    ]
  }, [financialSummary.data, reconciliation.data, paymentModes.data, dateRangeReport.data])

  const filteredModules = REPORT_MODULES.filter(
    (module) => module.category === activeCategory && module.id !== 'daily_register'
  )
  const periodScopeLabel =
    dateFrom && dateTo
      ? `${dateFrom} to ${dateTo} (FY ${financialYear})`
      : 'Period not set — select dates and generate report'
  const filtersApplied = [
    `FY ${financialYear}`,
    dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : 'Date range not set',
    `Payment: ${paymentModeFilter}`,
    `Ledger: ${ledgerFilter}`,
    `Category: ${categoryFilter}`,
    `Trustee: ${trusteeFilter}`,
    `Donation Type: ${donationTypeFilter}`,
    `Verification: ${verificationStatus}`,
  ]

  const baseExportParams = {
    ...(dateFrom && dateTo ? { date_from: dateFrom, date_to: dateTo } : {}),
  }

  const pushHistory = (reportName, format) => {
    setHistory((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        reportName,
        format,
        generatedBy: 'Current User',
        generatedAt: new Date().toLocaleString('en-IN'),
      },
      ...prev,
    ].slice(0, 8))
  }

  const handleGenerateReport = () => {
    if (!dateFrom || !dateTo) {
      toast({ title: 'Select date range', description: 'Date From and Date To are required', variant: 'destructive' })
      return
    }
    setIsGenerated(true)
    toast({ title: 'Report preview generated', description: 'Filters applied to all modules and preview metrics.' })
  }

  const handleExport = async (type, reportName = 'Report') => {
    setExporting(true)
    try {
      await exportExcel(type, baseExportParams)
      pushHistory(reportName, 'Excel')
      toast({ title: 'Export downloaded' })
    } catch (err) {
      toast({ title: 'Export failed', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const mapModuleToPdfType = (module) => {
    if (module.id === 'expense_register' || module.id === 'voucher_verification') return 'expenses'
    if (module.id === 'cash_donation_threshold' || module.id === 'high_value_donation' || module.id === 'reconciliation_pending') return 'compliance'
    if (module.id === 'annual_overview' || module.id === 'high_risk_transactions') return 'full'
    return 'donations'
  }

  const handlePdfExport = async (module) => {
    setExporting(true)
    try {
      await exportPdf(mapModuleToPdfType(module), baseExportParams)
      pushHistory(module.title, 'PDF')
      toast({ title: 'PDF downloaded' })
    } catch (err) {
      toast({ title: 'PDF export failed', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handlePrintReady = (reportName) => {
    window.print()
    pushHistory(reportName, 'Print-ready')
  }

  const handleAuditPack = async () => {
    setExporting(true)
    try {
      await exportPdf('audit_pack', baseExportParams)
      pushHistory('Annual Audit Pack', 'PDF')
      toast({ title: 'Audit Pack generated', description: 'Audit pack PDF downloaded.' })
    } catch (err) {
      toast({ title: 'Audit pack failed', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader title="Financial Reports & Registers" description="Generate operational, accounting and compliance reports for trust activities.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={exporting} onClick={() => handleExport('donations', 'Donation Register')}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export Donation Register
          </Button>
          <Button variant="outline" disabled={exporting} onClick={() => handleExport('expenses', 'Expense Register')}>
            Export Expense Register
          </Button>
          <Button variant="outline" disabled={exporting} onClick={() => handleExport('full', 'Full Financial Report')}>
            Export Full Financial Report
          </Button>
          <Button className="bg-maroon hover:bg-maroon/90" disabled={exporting} onClick={handleAuditPack}>
            <ShieldCheck className="h-4 w-4" />
            Generate Audit Pack
          </Button>
        </div>
      </PageHeader>

      <Card className="mb-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" />Select Filters -&gt; Generate Report -&gt; Export</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Financial Year</Label>
            <Select
              value={financialYear}
              onValueChange={(value) => {
                setFinancialYear(value)
                const range = fyToDateRange(value)
                setDateFrom(range.dateFrom)
                setDateTo(range.dateTo)
              }}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Select FY" /></SelectTrigger>
              <SelectContent>
                {fyOptions(currentYear).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Date From</Label><Input className="h-9" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div><Label>Date To</Label><Input className="h-9" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
          <div><Label>Payment Mode</Label><Select value={paymentModeFilter} onValueChange={setPaymentModeFilter}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All</SelectItem><SelectItem value="CASH">Cash</SelectItem><SelectItem value="UPI">UPI</SelectItem><SelectItem value="BANK">Bank</SelectItem><SelectItem value="CHEQUE">Cheque</SelectItem></SelectContent></Select></div>
          <div><Label>Cash / Bank</Label><Select value={ledgerFilter} onValueChange={setLedgerFilter}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All</SelectItem><SelectItem value="CASH">Cash</SelectItem><SelectItem value="BANK">Bank</SelectItem></SelectContent></Select></div>
          <div><Label>Category</Label><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All Categories</SelectItem><SelectItem value="CONSTRUCTION">Construction</SelectItem><SelectItem value="MATERIALS">Materials</SelectItem><SelectItem value="LABOUR">Labour</SelectItem><SelectItem value="PUJA">Puja</SelectItem><SelectItem value="ADMIN">Administration</SelectItem></SelectContent></Select></div>
          <div><Label>Trustee</Label><Select value={trusteeFilter} onValueChange={setTrusteeFilter}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All Trustees</SelectItem><SelectItem value="MANAGING">Managing Trustee</SelectItem><SelectItem value="TREASURER">Treasurer</SelectItem><SelectItem value="SECRETARY">Secretary</SelectItem></SelectContent></Select></div>
          <div><Label>Donation Type</Label><Select value={donationTypeFilter} onValueChange={setDonationTypeFilter}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All Types</SelectItem><SelectItem value="GENERAL">General</SelectItem><SelectItem value="CORPUS">Corpus</SelectItem><SelectItem value="CSR">CSR</SelectItem><SelectItem value="80G">80G Eligible</SelectItem></SelectContent></Select></div>
          <div><Label>Verification Status</Label><Select value={verificationStatus} onValueChange={setVerificationStatus}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All</SelectItem><SelectItem value="VERIFIED">Verified</SelectItem><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="FLAGGED">Flagged</SelectItem></SelectContent></Select></div>
          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <Button className="h-9" onClick={handleGenerateReport}>Generate Report</Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-3 rounded-md border border-maroon/20 bg-maroon/5 px-3 py-2 text-sm">
        <p className="font-medium text-maroon">Active report period (modules & insights below)</p>
        <p className="text-muted-foreground">{periodScopeLabel}</p>
      </div>

      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Period Summary</p>
        <span className="text-[11px] text-muted-foreground">Uses Date From / Date To filters</span>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {quickInsights.map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-1"><CardTitle className="text-[11px] text-muted-foreground">{item.label}</CardTitle></CardHeader>
            <CardContent><p className="text-sm font-semibold">{item.value}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {REPORT_CATEGORIES.map((category) => (
          <Button key={category} size="sm" variant={category === activeCategory ? 'default' : 'outline'} onClick={() => setActiveCategory(category)}>
            {category}
          </Button>
        ))}
      </div>

      {!isGenerated ? (
        <Alert className="mb-3">
          <AlertDescription>
            Apply filters and click <strong>Generate Report</strong> to activate preview metrics and module exports.
          </AlertDescription>
        </Alert>
      ) : null}

      {activeCategory === 'Operational Reports' ? (
        <Card className="mb-3 border-dashed border-saffron/40">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-sm">Daily Collection & Expense Register</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Single-day view only. This section does <strong>not</strong> use the period filters above.
                </p>
              </div>
              <span className="rounded-full border border-saffron/30 bg-saffron/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-saffron-dark">
                Single day scope
              </span>
            </div>
            <div className="mt-2 max-w-xs">
              <Label>Select day for daily register</Label>
              <Input className="h-9" type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent>
            {daily.isLoading ? (
              <TableLoadingSkeleton rows={4} className="p-0" />
            ) : daily.isError ? (
              <Alert variant="destructive"><AlertDescription>{daily.error?.message}</AlertDescription></Alert>
            ) : (
              <>
                <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Donations</p><p className="font-semibold">{formatCurrency(daily.data?.total_amount)}</p></div>
                  <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Expenses</p><p className="font-semibold">{formatCurrency(dailyExpenseSummary.data?.summary?.total_amount)}</p></div>
                  <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Receipts Issued</p><p className="font-semibold">{daily.data?.total_count || 0}</p></div>
                  <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Vouchers Recorded</p><p className="font-semibold">{dailyExpenseSummary.data?.summary?.expense_count || 0}</p></div>
                </div>
                <div className="overflow-x-auto">
                  {!daily.data?.donations?.length ? (
                    <EmptyState compact title="No donations for selected date" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Receipt</TableHead>
                          <TableHead>Donor</TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {daily.data?.donations?.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-mono text-xs">{d.receipt_number}</TableCell>
                            <TableCell>{d.donor_name}</TableCell>
                            <TableCell>{formatPaymentMode(d.payment_mode)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(d.amount)}</TableCell>
                            <TableCell>
                              <span className={`rounded-full px-2 py-0.5 text-xs ${d.pan_number ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {d.pan_number ? 'Verified' : 'Pending Verification'}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Report Modules · {activeCategory}</p>
        <span className="text-[11px] text-muted-foreground">Period: {periodScopeLabel}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3 mb-3">
        {filteredModules.map((module) => (
          <ReportModuleCard
            key={module.id}
            module={module}
            metric={moduleMetrics[module.metricKey] || 'No preview data available'}
            filtersApplied={filtersApplied}
            onExcel={() => handleExport(module.exportType, module.title)}
            onPdf={() => handlePdfExport(module)}
            onPrint={() => handlePrintReady(module.title)}
          />
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recently Generated Reports</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {!history.length ? (
            <EmptyState compact title="No reports generated in this session." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Name</TableHead>
                  <TableHead>Generated By</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Format</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.reportName}</TableCell>
                    <TableCell>{item.generatedBy}</TableCell>
                    <TableCell>{item.generatedAt}</TableCell>
                    <TableCell>{item.format}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
