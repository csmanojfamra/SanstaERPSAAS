import { useMemo, useState } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import FilterToolbar from '@/components/common/FilterToolbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import EmptyState from '@/components/common/EmptyState'
import TableLoadingSkeleton from '@/components/common/TableLoadingSkeleton'
import { downloadReconciliationPdf, useReconciliation, useReconcileDonation, useReconcileExpense } from '@/hooks/useAnalytics'
import { formatCurrency, formatDate, todayISO } from '@/utils/formatters'
import { toast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api'
import { CheckCircle2, AlertTriangle, Landmark } from 'lucide-react'

export default function Reconciliation() {
  const [activeTab, setActiveTab] = useState('PENDING_RECEIPTS')
  const [period, setPeriod] = useState('MONTHLY')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [bankAccount, setBankAccount] = useState('ALL')
  const [selectedDonationIds, setSelectedDonationIds] = useState([])
  const [selectedExpenseIds, setSelectedExpenseIds] = useState([])
  const periodParam = period === 'CUSTOM' && (!fromDate || !toDate) ? 'MONTHLY' : period

  const { data, isLoading, isError, error } = useReconciliation({
    period: periodParam,
    ...(periodParam === 'CUSTOM' ? { date_from: fromDate, date_to: toDate } : {}),
    ...(bankAccount !== 'ALL' ? { bank_account: bankAccount } : {}),
  })
  const reconcileDonation = useReconcileDonation()
  const reconcileExpense = useReconcileExpense()

  const handleDonation = async (id) => {
    try {
      await reconcileDonation.mutateAsync(id)
      toast({ title: 'Donation reconciled' })
    } catch (err) {
      toast({ title: 'Failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleExpense = async (id) => {
    try {
      await reconcileExpense.mutateAsync(id)
      toast({ title: 'Expense reconciled' })
    } catch (err) {
      toast({ title: 'Failed', description: getApiErrorMessage(err) })
    }
  }

  const toggleDonation = (id) => {
    setSelectedDonationIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleExpense = (id) => {
    setSelectedExpenseIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleBulkReconcile = async () => {
    try {
      if (activeTab === 'PENDING_RECEIPTS' && selectedDonationIds.length) {
        for (const id of selectedDonationIds) {
          // eslint-disable-next-line no-await-in-loop
          await reconcileDonation.mutateAsync(id)
        }
        toast({ title: 'Pending receipts marked reconciled' })
        setSelectedDonationIds([])
      } else if (activeTab === 'PENDING_PAYMENTS' && selectedExpenseIds.length) {
        for (const id of selectedExpenseIds) {
          // eslint-disable-next-line no-await-in-loop
          await reconcileExpense.mutateAsync(id)
        }
        toast({ title: 'Pending payments marked reconciled' })
        setSelectedExpenseIds([])
      }
    } catch (err) {
      toast({ title: 'Bulk reconcile failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const exportAuditCsv = () => {
    const rows =
      activeTab === 'PENDING_RECEIPTS'
        ? (data?.unreconciled_donations || []).map((d) => ({
            date: formatDate(d.donation_date),
            voucher_ref: d.receipt_number,
            type: 'Receipt',
            particulars: `Donation — ${d.donor_name}`,
            payment_mode: d.payment_mode,
            bank_reference: d.bank_ref || d.upi_ref || d.cheque_number || '-',
            amount: Number(d.amount || 0).toFixed(2),
            status: d.bank_ref || d.upi_ref || d.cheque_number ? 'Partially Matched' : 'Pending',
          }))
        : activeTab === 'PENDING_PAYMENTS'
          ? (data?.unreconciled_expenses || []).map((e) => ({
              date: formatDate(e.expense_date),
              voucher_ref: e.voucher_number || e.reference || e.id,
              type: 'Payment',
              particulars: `Expense — ${e.description}`,
              payment_mode: e.payment_mode || e.payment_channel,
              bank_reference: e.bank_ref || e.transaction_id || e.cheque_number || e.reference || '-',
              amount: Number(e.amount || 0).toFixed(2),
              status: e.bank_ref || e.transaction_id || e.reference ? 'Partially Matched' : 'Pending',
            }))
          : (data?.matched_entries || []).map((m) => ({
              date: formatDate(m.matched_on),
              voucher_ref: m.voucher_ref,
              type: m.entry_type,
              particulars: m.particulars,
              payment_mode: m.payment_mode,
              bank_reference: m.bank_reference || '-',
              amount: Number(m.amount || 0).toFixed(2),
              status: m.status,
              matched_by: m.matched_by || '-',
            }))

    const header = Object.keys(rows[0] || {
      date: '',
      voucher_ref: '',
      type: '',
      particulars: '',
      payment_mode: '',
      bank_reference: '',
      amount: '',
      status: '',
    })
    const csv = [header.join(','), ...rows.map((r) => header.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reconciliation-register-${todayISO()}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  const exportPdf = async () => {
    try {
      await downloadReconciliationPdf({
        period: periodParam,
        ...(periodParam === 'CUSTOM' ? { date_from: fromDate, date_to: toDate } : {}),
        ...(bankAccount !== 'ALL' ? { bank_account: bankAccount } : {}),
      })
      toast({ title: 'PDF exported successfully' })
    } catch (err) {
      toast({ title: 'Export failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Bank Reconciliation Register" />
        <Alert variant="destructive"><AlertDescription>{error?.message}</AlertDescription></Alert>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Bank Reconciliation Register"
        mobileTitle="Reconciliation"
        description="Track unmatched receipts and payments pending bank verification and settlement."
      />

      <FilterToolbar>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Select period" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MONTHLY">Monthly</SelectItem>
            <SelectItem value="QUARTERLY">Quarterly</SelectItem>
            <SelectItem value="YEARLY">Yearly</SelectItem>
            <SelectItem value="CUSTOM">Custom Date</SelectItem>
          </SelectContent>
        </Select>
        {period === 'CUSTOM' ? (
          <>
            <Input className="h-9" type="date" value={fromDate} max={toDate || todayISO()} onChange={(e) => setFromDate(e.target.value)} aria-label="Date from" />
            <Input className="h-9" type="date" value={toDate} min={fromDate || undefined} max={todayISO()} onChange={(e) => setToDate(e.target.value)} aria-label="Date to" />
          </>
        ) : null}
        <Select value={bankAccount} onValueChange={setBankAccount}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Select Bank Account" /></SelectTrigger>
          <SelectContent>
            {(data?.bank_accounts || [{ value: 'ALL', label: 'All Bank Accounts' }]).map((acc) => (
              <SelectItem key={acc.value} value={acc.value}>{acc.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterToolbar>

      {isLoading ? (
        <Skeleton className="h-24 w-full mb-6" />
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs">Pending Receipts</CardTitle></CardHeader>
            <CardContent>
              <p className="text-lg font-bold text-maroon">{data?.totals?.pending_receipts_count ?? 0}</p>
              <p className="text-sm text-muted-foreground">{formatCurrency(data?.totals?.unreconciled_donation_amount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs">Pending Payments</CardTitle></CardHeader>
            <CardContent>
              <p className="text-lg font-bold text-maroon">{data?.totals?.pending_payments_count ?? 0}</p>
              <p className="text-sm text-muted-foreground">{formatCurrency(data?.totals?.unreconciled_expense_amount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs">Matched Entries</CardTitle></CardHeader>
            <CardContent>
              <p className="text-lg font-bold text-emerald-700">{data?.totals?.matched_count ?? 0}</p>
              <p className="text-sm text-muted-foreground">{formatCurrency(data?.totals?.matched_amount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs">Settlement Difference</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-lg font-bold ${(Number(data?.totals?.settlement_difference) || 0) === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {formatCurrency(data?.totals?.settlement_difference)}
              </p>
              <p className="text-sm text-muted-foreground">Book vs Pending Bank</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs">Last Reconciliation Date</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm font-semibold">{data?.totals?.last_reconciliation_date ? formatDate(data.totals.last_reconciliation_date) : '—'}</p>
              <p className="text-sm text-muted-foreground">{data?.monthly_reconciliation_status || 'Pending'}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!isLoading ? (
        <div className={`mb-3 rounded-md border px-3 py-2 text-sm ${Number(data?.totals?.pending_receipts_count || 0) + Number(data?.totals?.pending_payments_count || 0) > 0 ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {Number(data?.totals?.pending_receipts_count || 0) + Number(data?.totals?.pending_payments_count || 0) > 0
            ? `${data?.totals?.pending_receipts_count || 0} receipt(s) and ${data?.totals?.pending_payments_count || 0} payment(s) are pending bank reconciliation.`
            : 'All transactions reconciled successfully.'}
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" variant={activeTab === 'PENDING_RECEIPTS' ? 'default' : 'outline'} onClick={() => setActiveTab('PENDING_RECEIPTS')}>Pending Receipts</Button>
        <Button size="sm" variant={activeTab === 'PENDING_PAYMENTS' ? 'default' : 'outline'} onClick={() => setActiveTab('PENDING_PAYMENTS')}>Pending Payments</Button>
        <Button size="sm" variant={activeTab === 'RECONCILED_ENTRIES' ? 'default' : 'outline'} onClick={() => setActiveTab('RECONCILED_ENTRIES')}>Reconciled Entries</Button>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={exportAuditCsv}>Export Excel</Button>
          <Button size="sm" variant="outline" onClick={exportPdf}>Export PDF</Button>
          {(activeTab === 'PENDING_RECEIPTS' && selectedDonationIds.length > 0) || (activeTab === 'PENDING_PAYMENTS' && selectedExpenseIds.length > 0) ? (
            <Button size="sm" onClick={handleBulkReconcile}>Mark Reconciled ({activeTab === 'PENDING_RECEIPTS' ? selectedDonationIds.length : selectedExpenseIds.length})</Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{activeTab === 'PENDING_RECEIPTS' ? 'Pending Receipts' : activeTab === 'PENDING_PAYMENTS' ? 'Pending Payments' : 'Recently Reconciled Entries'}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {activeTab === 'PENDING_RECEIPTS' ? (
            isLoading ? (
              <TableLoadingSkeleton rows={6} className="p-4" />
            ) : !data?.unreconciled_donations?.length ? <EmptyState compact title="No unreconciled donation entries found for selected period." /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead>Date</TableHead>
                    <TableHead>Voucher Ref.</TableHead>
                    <TableHead>Transaction Type</TableHead>
                    <TableHead>Particulars</TableHead>
                    <TableHead>Payment Mode</TableHead>
                    <TableHead>Bank Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.unreconciled_donations.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell><input type="checkbox" checked={selectedDonationIds.includes(d.id)} onChange={() => toggleDonation(d.id)} /></TableCell>
                      <TableCell>{formatDate(d.donation_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{d.receipt_number}</TableCell>
                      <TableCell><span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Receipt</span></TableCell>
                      <TableCell>Donation — {d.donor_name}</TableCell>
                      <TableCell><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{d.payment_mode}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.bank_ref || d.upi_ref || d.cheque_number || '—'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(d.amount)}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${(d.bank_ref || d.upi_ref || d.cheque_number) ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {(d.bank_ref || d.upi_ref || d.cheque_number) ? 'Partially Matched' : 'Pending'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => handleDonation(d.id)} disabled={reconcileDonation.isPending}>
                          Match Entry
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : activeTab === 'PENDING_PAYMENTS' ? (
            isLoading ? (
              <TableLoadingSkeleton rows={6} className="p-4" />
            ) : !data?.unreconciled_expenses?.length ? <EmptyState compact title="No unreconciled payment entries found for selected period." /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead>Date</TableHead>
                    <TableHead>Voucher Ref.</TableHead>
                    <TableHead>Transaction Type</TableHead>
                    <TableHead>Particulars</TableHead>
                    <TableHead>Payment Mode</TableHead>
                    <TableHead>Bank Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.unreconciled_expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell><input type="checkbox" checked={selectedExpenseIds.includes(e.id)} onChange={() => toggleExpense(e.id)} /></TableCell>
                      <TableCell>{formatDate(e.expense_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{e.voucher_number || e.reference || e.id}</TableCell>
                      <TableCell><span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">Payment</span></TableCell>
                      <TableCell className="max-w-[240px] truncate">Expense — {e.description}</TableCell>
                      <TableCell><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{e.payment_mode || e.payment_channel || 'BANK'}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.bank_ref || e.transaction_id || e.reference || '—'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(e.amount)}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${(e.bank_ref || e.transaction_id || e.reference) ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {(e.bank_ref || e.transaction_id || e.reference) ? 'Partially Matched' : 'Pending'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="secondary" onClick={() => handleExpense(e.id)} disabled={reconcileExpense.isPending}>
                          Verify Settlement
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : (
            isLoading ? (
              <TableLoadingSkeleton rows={6} className="p-4" />
            ) : !data?.matched_entries?.length ? (
              <EmptyState compact title="No reconciled entries found for selected period." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Voucher Ref.</TableHead>
                    <TableHead>Transaction Type</TableHead>
                    <TableHead>Particulars</TableHead>
                    <TableHead>Payment Mode</TableHead>
                    <TableHead>Bank Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Matched By</TableHead>
                    <TableHead>Matched On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.matched_entries.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{formatDate(m.matched_on)}</TableCell>
                      <TableCell className="font-mono text-xs">{m.voucher_ref}</TableCell>
                      <TableCell>{m.entry_type}</TableCell>
                      <TableCell>{m.particulars}</TableCell>
                      <TableCell>{m.payment_mode || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.bank_reference || '—'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(m.amount)}</TableCell>
                      <TableCell><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Matched</span></TableCell>
                      <TableCell>{m.matched_by || 'System'}</TableCell>
                      <TableCell>{formatDate(m.matched_on)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
        </CardContent>
      </Card>

      <Card className="mt-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Landmark className="h-4 w-4 text-saffron-dark" />
            Balance Difference Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3 text-sm">
          <div className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">Book Balance (Pending Receipts)</p>
            <p className="font-semibold">{formatCurrency(data?.totals?.unreconciled_donation_amount)}</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">Bank Balance (Pending Payments)</p>
            <p className="font-semibold">{formatCurrency(data?.totals?.unreconciled_expense_amount)}</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">Difference</p>
            <p className={`font-semibold ${Number(data?.totals?.settlement_difference || 0) === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {formatCurrency(data?.totals?.settlement_difference)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recently Reconciled Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <TableLoadingSkeleton rows={4} className="p-4" />
          ) : !data?.recent_reconciliation_logs?.length ? (
            <EmptyState compact title="No recent reconciliation actions." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Matched By</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent_reconciliation_logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDate(log.created_at)}</TableCell>
                    <TableCell>{log.reconciled_user?.name || 'System'}</TableCell>
                    <TableCell>
                      {log.donation ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Donation</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-blue-700"><CheckCircle2 className="h-3.5 w-3.5" /> Expense</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.donation?.receipt_number || log.expense?.voucher_number || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.remarks || '—'}</TableCell>
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
