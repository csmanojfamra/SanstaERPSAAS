import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet, Loader2, RefreshCcw, AlertTriangle } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import FilterToolbar from '@/components/common/FilterToolbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate, todayISO } from '@/utils/formatters'
import { useCashBook, downloadCashbookExcel, downloadCashbookPdf } from '@/hooks/useCashBook'
import EmptyState from '@/components/common/EmptyState'
import TableLoadingSkeleton from '@/components/common/TableLoadingSkeleton'
import { toast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'

function channelLabel(kind) {
  return kind === 'CASH' ? 'Cash' : 'Bank'
}

function periodLabel(selectedPeriod, period) {
  const periodFallbacks = {
    MONTHLY: 'This month',
    QUARTERLY: 'This quarter',
    YEARLY: 'This year',
    CUSTOM: 'Custom range',
  }
  if (!selectedPeriod?.period) return periodFallbacks[period] || period
  const from = selectedPeriod.date_from ? new Date(selectedPeriod.date_from) : null
  if (selectedPeriod.period === 'MONTHLY' && from) {
    return from.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  }
  if (selectedPeriod.period === 'QUARTERLY' && from) {
    return `Q${Math.floor(from.getMonth() / 3) + 1} ${from.getFullYear()}`
  }
  if (selectedPeriod.period === 'YEARLY' && from) return String(from.getFullYear())
  if (selectedPeriod.period === 'CUSTOM') {
    const to = selectedPeriod.date_to ? new Date(selectedPeriod.date_to) : null
    if (from && to) {
      return `${from.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} to ${to.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
    }
  }
  return selectedPeriod.label || periodFallbacks[period] || period
}

function formatBalanceWithSide(value) {
  const n = Number(value) || 0
  const suffix = n >= 0 ? 'Dr' : 'Cr'
  return `${formatCurrency(Math.abs(n), true)} ${suffix}`
}

function getDailyGroupedRows(entries = []) {
  const grouped = []
  let currentDate = null
  let dayReceipts = 0
  let dayPayments = 0
  let bucket = []
  const flush = () => {
    if (!currentDate) return
    grouped.push({
      type: 'day-total',
      date: currentDate,
      receipts: dayReceipts,
      payments: dayPayments,
    })
    bucket = []
    dayReceipts = 0
    dayPayments = 0
  }
  for (const row of entries) {
    const dateKey = String(row.date).slice(0, 10)
    if (currentDate && currentDate !== dateKey) {
      flush()
    }
    if (!currentDate || currentDate !== dateKey) {
      currentDate = dateKey
    }
    dayReceipts += Number(row.debit || 0)
    dayPayments += Number(row.credit || 0)
    grouped.push({ type: 'entry', row })
    bucket.push(row)
  }
  flush()
  return grouped
}

function LedgerTable({ ledger, isLoading, channel }) {
  if (isLoading) return <TableLoadingSkeleton rows={5} className="p-0" />

  if ((ledger?.entries?.length || 0) === 0) {
    if (channel === 'BANK') {
      return (
        <EmptyState
          compact
          title="No bank transactions recorded for selected period"
          description="Use Bank donations, UPI collections or Bank expense payments to generate bank book entries."
        />
      )
    }
    return <EmptyState compact title="No entries in selected period" />
  }
  const rows = getDailyGroupedRows(ledger.entries || [])

  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead className="h-9 px-2">Date</TableHead>
          <TableHead className="h-9 px-2">Voucher Ref.</TableHead>
          <TableHead className="h-9 px-2">Particulars</TableHead>
          <TableHead className="h-9 px-2 text-right">Receipts (Debit)</TableHead>
          <TableHead className="h-9 px-2 text-right">Payments (Credit)</TableHead>
          <TableHead className="h-9 px-2 text-right">Running Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {!isLoading && ledger?.opening_balance != null && (
          <TableRow className="bg-muted/30">
            <TableCell colSpan={3} className="px-2 py-1.5 font-medium">
              Opening balance
            </TableCell>
            <TableCell className="px-2 py-1.5 text-right">
              {ledger.opening_balance > 0 ? formatCurrency(ledger.opening_balance, true) : '—'}
            </TableCell>
            <TableCell className="px-2 py-1.5 text-right">
              {ledger.opening_balance < 0 ? formatCurrency(Math.abs(ledger.opening_balance), true) : '—'}
            </TableCell>
            <TableCell className="px-2 py-1.5 text-right font-medium">
              {formatBalanceWithSide(ledger.opening_balance)}
            </TableCell>
          </TableRow>
        )}
        {rows.map((item, idx) => {
          if (item.type === 'day-total') {
            return (
              <TableRow key={`dt-${item.date}-${idx}`} className="bg-muted/20">
                <TableCell colSpan={3} className="px-2 py-1.5 font-medium">
                  {formatDate(item.date)} totals
                </TableCell>
                <TableCell className="px-2 py-1.5 text-right font-medium text-emerald-700">
                  {item.receipts > 0 ? formatCurrency(item.receipts, true) : '—'}
                </TableCell>
                <TableCell className="px-2 py-1.5 text-right font-medium text-amber-700">
                  {item.payments > 0 ? formatCurrency(item.payments, true) : '—'}
                </TableCell>
                <TableCell className="px-2 py-1.5 text-right">—</TableCell>
              </TableRow>
            )
          }
          const r = item.row
          return (
            <TableRow key={r.id}>
              <TableCell className="px-2 py-1.5">{formatDate(r.date)}</TableCell>
              <TableCell className="px-2 py-1.5 font-mono text-[11px]">{r.ref || '—'}</TableCell>
              <TableCell className="px-2 py-1.5">
                <div className="font-medium">
                  {r.type_label || (r.kind === 'DONATION' ? 'Donation' : 'Expense')} — {r.description}
                </div>
                {r.meta ? <div className="text-[11px] text-muted-foreground">{r.meta}</div> : null}
                {r.narration ? <div className="text-[11px] text-muted-foreground">Narration: {r.narration}</div> : null}
                {r.created_by ? <div className="text-[11px] text-muted-foreground">Created By: {r.created_by}</div> : null}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-right text-emerald-700">
                {r.debit > 0 ? formatCurrency(r.debit, true) : '—'}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-right text-amber-700">
                {r.credit > 0 ? formatCurrency(r.credit, true) : '—'}
              </TableCell>
              <TableCell
                className={cn(
                  'px-2 py-1.5 text-right font-medium',
                  Number(r.running_balance) < 0 ? 'text-destructive' : 'text-foreground'
                )}
              >
                {formatBalanceWithSide(r.running_balance)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function LedgerPanel({ channel, ledger, isLoading, onExport, onExportCombined }) {
  const label = channelLabel(channel)
  const [exporting, setExporting] = useState(null)

  const handleExport = async (format) => {
    setExporting(format)
    try {
      await onExport(format, channel)
      toast({ title: `${label} ${format === 'excel' ? 'Excel' : 'PDF'} downloaded` })
    } catch (err) {
      toast({
        title: 'Export failed',
        description: getApiErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setExporting(null)
    }
  }

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-2 pt-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <CardTitle className="text-base">{label} Book Register</CardTitle>
          <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start sm:w-auto"
              disabled={isLoading || exporting}
              onClick={() => handleExport('excel')}
            >
              {exporting === 'excel' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              <span className="ml-1 hidden sm:inline">Export {label} Book (Excel)</span>
              <span className="ml-1 sm:hidden">Excel</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start sm:w-auto"
              disabled={isLoading || exporting}
              onClick={() => handleExport('pdf')}
            >
              {exporting === 'pdf' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="ml-1 hidden sm:inline">Export {label} Book (PDF)</span>
              <span className="ml-1 sm:hidden">PDF</span>
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start sm:w-auto" onClick={onExportCombined} disabled={isLoading || exporting}>
              <Download className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Export Combined Ledger</span>
              <span className="ml-1 sm:hidden">Combined</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!isLoading ? (
          <>
            <div className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="rounded border bg-muted/20 px-2 py-1.5">
                <p className="text-[11px] text-muted-foreground">Opening Balance</p>
                <p className="text-sm font-semibold">{formatBalanceWithSide(ledger?.opening_balance || 0)}</p>
              </div>
              <div className="rounded border bg-emerald-50 px-2 py-1.5">
                <p className="text-[11px] text-muted-foreground">Total Receipts</p>
                <p className="text-sm font-semibold text-emerald-700">{formatCurrency(ledger?.totals?.debit || 0, true)}</p>
              </div>
              <div className="rounded border bg-amber-50 px-2 py-1.5">
                <p className="text-[11px] text-muted-foreground">Total Payments</p>
                <p className="text-sm font-semibold text-amber-700">{formatCurrency(ledger?.totals?.credit || 0, true)}</p>
              </div>
              <div className={cn('rounded border px-2 py-1.5', Number(ledger?.closing_balance || 0) < 0 ? 'bg-red-50 border-red-200' : 'bg-muted/20')}>
                <p className="text-[11px] text-muted-foreground">Closing Balance</p>
                <p className={cn('text-sm font-semibold', Number(ledger?.closing_balance || 0) < 0 ? 'text-red-700' : '')}>
                  {formatBalanceWithSide(ledger?.closing_balance || 0)}
                </p>
              </div>
            </div>
            {Number(ledger?.closing_balance || 0) < 0 ? (
              <div className="mb-2 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
                Cash book shows negative balance. Review payment entries or backdated vouchers.
              </div>
            ) : null}
          </>
        ) : null}

        <LedgerTable ledger={ledger} isLoading={isLoading} channel={channel} />

        {!isLoading ? (
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded border-t bg-muted/20 px-2 py-1.5 text-xs">
            <span>Total Receipts: <strong className="text-emerald-700">{formatCurrency(ledger?.totals?.debit || 0, true)}</strong></span>
            <span>Total Payments: <strong className="text-amber-700">{formatCurrency(ledger?.totals?.credit || 0, true)}</strong></span>
            <span>Closing Balance: <strong>{formatBalanceWithSide(ledger?.closing_balance || 0)}</strong></span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default function CashBook() {
  const [period, setPeriod] = useState('MONTHLY')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [activeLedger, setActiveLedger] = useState('CASH')
  const [exportingBoth, setExportingBoth] = useState(null)
  const periodParam = period === 'CUSTOM' && (!customFrom || !customTo) ? 'MONTHLY' : period
  const queryDateFrom = periodParam === 'CUSTOM' ? customFrom : undefined
  const queryDateTo = periodParam === 'CUSTOM' ? customTo : undefined

  const { data, isLoading, isError, error, refetch } = useCashBook({
    period: periodParam,
    dateFrom: queryDateFrom || undefined,
    dateTo: queryDateTo || undefined,
  })

  const cash = data?.cashbook?.CASH
  const bank = data?.cashbook?.BANK
  const selectedPeriodLabel = useMemo(
    () => periodLabel(data?.selected_period, periodParam),
    [data?.selected_period, periodParam]
  )
  const displayPeriodLabel =
    isLoading && !data?.selected_period ? 'Loading period…' : selectedPeriodLabel

  const exportOpts = {
    period: periodParam,
    dateFrom: queryDateFrom || undefined,
    dateTo: queryDateTo || undefined,
  }

  const handleExportBoth = async (format) => {
    setExportingBoth(format)
    try {
      if (format === 'excel') {
        await downloadCashbookExcel({ ...exportOpts, channel: 'both' })
      } else {
        await downloadCashbookPdf({ ...exportOpts, channel: 'both' })
      }
      toast({ title: `Combined ledger ${format === 'excel' ? 'Excel' : 'PDF'} downloaded` })
    } catch (err) {
      toast({
        title: 'Export failed',
        description: getApiErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setExportingBoth(null)
    }
  }

  const handleLedgerExport = async (format, channel) => {
    if (format === 'excel') {
      await downloadCashbookExcel({ ...exportOpts, channel })
    } else {
      await downloadCashbookPdf({ ...exportOpts, channel })
    }
  }

  return (
    <>
      <PageHeader
        title="Trust Cash & Bank Ledger"
        mobileTitle="Cash Book"
        description="Track receipts, payments and running balances across trust cash and bank accounts."
      />

      <FilterToolbar layout="period">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="period-bar-field h-9 min-w-0 flex-1 border-0 bg-muted/50 shadow-none sm:border sm:bg-background sm:shadow-sm">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MONTHLY">Monthly</SelectItem>
            <SelectItem value="QUARTERLY">Quarterly</SelectItem>
            <SelectItem value="YEARLY">Yearly</SelectItem>
            <SelectItem value="CUSTOM">Custom Date</SelectItem>
          </SelectContent>
        </Select>
        {period === 'CUSTOM' ? (
          <>
            <Input
              className="period-bar-field h-9"
              type="date"
              value={customFrom}
              max={customTo || todayISO()}
              onChange={(e) => setCustomFrom(e.target.value)}
              aria-label="Date from"
            />
            <Input
              className="period-bar-field h-9"
              type="date"
              value={customTo}
              min={customFrom || undefined}
              max={todayISO()}
              onChange={(e) => setCustomTo(e.target.value)}
              aria-label="Date to"
            />
          </>
        ) : null}
        <Select value={activeLedger} onValueChange={setActiveLedger}>
          <SelectTrigger className="period-bar-field h-9 min-w-0 flex-1 sm:min-w-[140px]">
            <SelectValue placeholder="Ledger" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CASH">Cash Book</SelectItem>
            <SelectItem value="BANK">Bank Book</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-9 flex-1 sm:flex-none"
            onClick={() => handleExportBoth('excel')}
            disabled={isLoading || exportingBoth}
          >
            {exportingBoth === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">Export Combined</span>
          </Button>
          <Button variant="outline" size="sm" className="h-9 flex-1 sm:flex-none" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCcw className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">Refresh</span>
          </Button>
        </div>
        <p className="w-full truncate text-[11px] text-muted-foreground sm:hidden">{displayPeriodLabel}</p>
      </FilterToolbar>

      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {`FY ${new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1}-${String(((new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1) + 1) % 100).padStart(2, '0')} · ${displayPeriodLabel}`}
      </div>

      {isError && (
        <Card className="mb-2">
          <CardContent className="p-3 text-sm text-destructive">
            Failed to load cash book. {error?.message ? `(${error.message})` : null}
          </CardContent>
        </Card>
      )}

      <div className="mb-2 flex w-full gap-1">
        <Button size="sm" className="flex-1 sm:flex-none" variant={activeLedger === 'CASH' ? 'default' : 'outline'} onClick={() => setActiveLedger('CASH')}>
          Cash Book
        </Button>
        <Button size="sm" className="flex-1 sm:flex-none" variant={activeLedger === 'BANK' ? 'default' : 'outline'} onClick={() => setActiveLedger('BANK')}>
          Bank Book
        </Button>
      </div>

      {activeLedger === 'CASH' ? (
        <LedgerPanel
          channel="CASH"
          ledger={cash}
          isLoading={isLoading}
          onExport={handleLedgerExport}
          onExportCombined={() => handleExportBoth('pdf')}
        />
      ) : (
        <LedgerPanel
          channel="BANK"
          ledger={bank}
          isLoading={isLoading}
          onExport={handleLedgerExport}
          onExportCombined={() => handleExportBoth('pdf')}
        />
      )}
    </>
  )
}
