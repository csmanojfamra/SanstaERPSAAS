import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Download,
  MessageCircle,
  Pencil,
  Trash2,
  Search,
  MoreVertical,
  FileSpreadsheet,
  FileText,
  Printer,
  Eye,
  Mail,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  Users,
  TrendingUp,
  Wallet,
  Building2,
} from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import ConfirmActionDialog from '@/components/common/ConfirmActionDialog'
import EmptyState from '@/components/common/EmptyState'
import PaginationBar from '@/components/common/PaginationBar'
import TableLoadingSkeleton from '@/components/common/TableLoadingSkeleton'
import DonationDetailsDrawer from '@/components/donations/DonationDetailsDrawer'
import {
  useDonations,
  useUpdateDonation,
  useDeleteDonation,
  useSendWhatsApp,
  useRegenerateReceipt,
  downloadReceipt,
  exportDonationsExcel,
  exportDonationsPdf,
} from '@/hooks/useDonations'
import { formatCurrency, formatDate, formatPaymentMode, todayISO } from '@/utils/formatters'
import { getApiErrorMessage } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { useAuthStore } from '@/store/useAuthStore'

const PAYMENT_MODES = ['CASH', 'UPI', 'CHEQUE', 'NEFT', 'RTGS', 'DD', 'ONLINE']
const RECEIPT_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'RECEIPT_GENERATED', label: 'Receipt Generated' },
  { value: 'RECEIPT_PENDING', label: 'Receipt Pending' },
  { value: 'WHATSAPP_SENT', label: 'WhatsApp Sent' },
  { value: 'EMAIL_SENT', label: 'Email Sent' },
]
const DONOR_TYPE_OPTIONS = [
  { value: 'all', label: 'All donors' },
  { value: 'NEW', label: 'New donors' },
  { value: 'REPEAT', label: 'Repeat donors' },
]
const MAX_AMOUNT = 99_999_999.99

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

function dateShortcuts() {
  const now = new Date()
  const today = isoDate(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - 6)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const fyStart = new Date(fyStartYear, 3, 1)
  const fyEnd = new Date(fyStartYear + 1, 2, 31)
  return {
    today: { from: today, to: today, label: 'Today' },
    yesterday: { from: isoDate(yesterday), to: isoDate(yesterday), label: 'Yesterday' },
    week: { from: isoDate(weekStart), to: today, label: 'This Week' },
    month: { from: isoDate(monthStart), to: isoDate(monthEnd), label: 'This Month' },
    fy: { from: isoDate(fyStart), to: isoDate(fyEnd), label: 'Current FY' },
  }
}

function DonorRegisterCell({ donation, onOpen }) {
  const d = donation
  const donorMeta =
    d.donor_frequency === 'REPEAT'
      ? `Repeat · ${d.donor_donation_count}`
      : 'New donor'
  const contact = [d.donor_mobile, d.donor_city].filter(Boolean).join(' · ')
  const flags = []
  if (d.is_high_value) flags.push({ key: 'hv', label: 'High value', className: 'bg-red-500' })
  if (d.pan_recommended) flags.push({ key: 'pan', label: 'PAN recommended', className: 'bg-amber-500' })
  if (d.verification_recommended) flags.push({ key: 'ver', label: 'Verify recommended', className: 'bg-slate-400' })

  return (
    <div className="min-w-[140px] max-w-[220px]">
      <div className="flex items-center gap-1">
        <button type="button" className="truncate text-sm font-medium hover:underline" onClick={onOpen}>
          {d.donor_name}
        </button>
        {flags.length ? (
          <span className="inline-flex shrink-0 items-center gap-0.5" title={flags.map((f) => f.label).join(' · ')}>
            {flags.map((f) => (
              <span key={f.key} className={`h-1.5 w-1.5 rounded-full ${f.className}`} />
            ))}
          </span>
        ) : null}
      </div>
      <p className="truncate text-[11px] text-muted-foreground">
        {donorMeta}
        {contact ? ` · ${contact}` : ''}
      </p>
    </div>
  )
}

function ReceiptStatusCompact({ statuses = [] }) {
  const isPending = statuses.includes('RECEIPT_PENDING')
  const primaryLabel = isPending ? 'Pending' : 'Generated'
  const primaryClass = isPending
    ? 'bg-amber-50 text-amber-800 ring-amber-200'
    : 'bg-emerald-50 text-emerald-800 ring-emerald-200'

  const iconHints = []
  if (statuses.includes('WHATSAPP_SENT')) iconHints.push('WA')
  if (statuses.includes('EMAIL_SENT')) iconHints.push('Email')
  if (statuses.includes('PRINTED')) iconHints.push('Print')
  if (statuses.includes('REGENERATED')) iconHints.push('Regen')

  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span className={`inline-flex h-5 items-center rounded px-1.5 text-[10px] font-medium ring-1 ring-inset ${primaryClass}`}>
        {primaryLabel}
      </span>
      {iconHints.length ? (
        <span className="text-[10px] text-muted-foreground" title={iconHints.join(', ')}>
          +{iconHints.length}
        </span>
      ) : null}
    </div>
  )
}

function KpiCard({ title, value, sub, icon: Icon }) {
  return (
    <Card className="border-border/80">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="mt-1 text-xl font-semibold leading-tight">{value}</p>
            {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
          </div>
          <span className="rounded-md bg-muted p-1.5">
            <Icon className="h-3.5 w-3.5 text-saffron-dark" />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Donations() {
  const [searchParams] = useSearchParams()
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN')
  const printRef = useRef(null)
  const shortcuts = useMemo(() => dateShortcuts(), [])

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [receiptSearch, setReceiptSearch] = useState('')
  const [mobileFilter, setMobileFilter] = useState('')
  const [paymentMode, setPaymentMode] = useState('all')
  const [purposeFilter, setPurposeFilter] = useState('')
  const [receiptStatus, setReceiptStatus] = useState('all')
  const [donorType, setDonorType] = useState('all')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [editDonation, setEditDonation] = useState(null)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [exporting, setExporting] = useState('')

  const exportParams = useMemo(
    () => ({
      ...(search && { search }),
      ...(receiptSearch && { receipt_number: receiptSearch }),
      ...(mobileFilter && { donor_mobile: mobileFilter }),
      ...(paymentMode !== 'all' && { payment_mode: paymentMode }),
      ...(purposeFilter && { purpose: purposeFilter }),
      ...(receiptStatus !== 'all' && { receipt_status: receiptStatus }),
      ...(donorType !== 'all' && { donor_frequency: donorType }),
      ...(minAmount && { amount_min: minAmount }),
      ...(maxAmount && { amount_max: maxAmount }),
      ...(dateFrom && { date_from: dateFrom }),
      ...(dateTo && { date_to: dateTo }),
    }),
    [
      search,
      receiptSearch,
      mobileFilter,
      paymentMode,
      purposeFilter,
      receiptStatus,
      donorType,
      minAmount,
      maxAmount,
      dateFrom,
      dateTo,
    ]
  )

  const params = { page, limit: 25, ...exportParams }

  const { data, isLoading, isError, error } = useDonations(params)
  const updateMutation = useUpdateDonation()
  const deleteMutation = useDeleteDonation()
  const whatsappMutation = useSendWhatsApp()
  const regenerateMutation = useRegenerateReceipt()

  useEffect(() => {
    const initialSearch = searchParams.get('search') || ''
    if (initialSearch) {
      setSearchInput(initialSearch)
      setSearch(initialSearch)
      setPage(1)
    }
  }, [searchParams])

  const applyShortcut = (key) => {
    const s = shortcuts[key]
    if (!s) return
    setDateFrom(s.from)
    setDateTo(s.to)
    setPage(1)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const openEdit = (d) => {
    setEditDonation(d)
    setEditForm({
      donor_name: d.donor_name,
      donor_mobile: d.donor_mobile,
      donor_city: d.donor_city || '',
      amount: String(d.amount),
      payment_mode: d.payment_mode,
      purpose: d.purpose,
      donation_date: d.donation_date?.slice?.(0, 10) || d.donation_date?.split?.('T')?.[0],
      upi_ref: d.upi_ref || '',
      cheque_number: d.cheque_number || '',
      notes: d.notes || '',
      pan_number: d.pan_number || '',
    })
  }

  const saveEdit = async () => {
    try {
      await updateMutation.mutateAsync({
        id: editDonation.id,
        ...editForm,
        amount: parseFloat(editForm.amount),
      })
      toast({ title: 'Donation updated' })
      setEditDonation(null)
    } catch (err) {
      toast({ title: 'Update failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    try {
      await deleteMutation.mutateAsync(pendingDeleteId)
      toast({ title: 'Donation deleted' })
      setPendingDeleteId(null)
    } catch (err) {
      toast({ title: 'Delete failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleWhatsApp = async (id) => {
    try {
      const result = await whatsappMutation.mutateAsync(id)
      toast({ title: 'WhatsApp', description: result.message || 'Request sent' })
    } catch (err) {
      toast({ title: 'WhatsApp failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleReceipt = async (d) => {
    try {
      await downloadReceipt(d.id, d.receipt_number)
      toast({ title: 'Receipt downloaded' })
    } catch (err) {
      toast({ title: 'Download failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleRegenerate = async (id) => {
    try {
      await regenerateMutation.mutateAsync(id)
      toast({ title: 'Receipt regenerated' })
    } catch (err) {
      toast({ title: 'Regenerate failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleExportExcel = async () => {
    setExporting('excel')
    try {
      await exportDonationsExcel(exportParams)
      toast({ title: 'Excel exported' })
    } catch (err) {
      toast({ title: 'Export failed', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setExporting('')
    }
  }

  const handleExportPdf = async () => {
    setExporting('pdf')
    try {
      await exportDonationsPdf(exportParams)
      toast({ title: 'PDF exported' })
    } catch (err) {
      toast({ title: 'Export failed', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setExporting('')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const kpis = data?.kpis
  const analytics = data?.analytics
  const highValueThreshold = Number(data?.thresholds?.high_value || 50000)

  return (
    <>
      <PageHeader
        title="Donation Register"
        description="Receipt management, donor tracking and collection governance for the trust."
      >
        <Button asChild>
          <Link to="/donations/new">
            <Plus className="h-4 w-4" />
            Record Donation
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title="Today's Collection"
          value={formatCurrency(kpis?.today?.amount)}
          sub={`${kpis?.today?.count ?? 0} receipts`}
          icon={IndianRupee}
        />
        <KpiCard
          title="This Month"
          value={formatCurrency(kpis?.month?.amount)}
          sub={`${kpis?.month?.count ?? 0} receipts`}
          icon={TrendingUp}
        />
        <KpiCard
          title="Total Donors"
          value={String(kpis?.totalDonors ?? 0)}
          sub="Unique donor mobiles"
          icon={Users}
        />
        <KpiCard
          title="Average Donation"
          value={formatCurrency(kpis?.averageDonation)}
          sub="Filtered register average"
          icon={IndianRupee}
        />
        <KpiCard
          title="Cash Donations"
          value={formatCurrency(kpis?.cash?.amount)}
          sub={`${kpis?.cash?.count ?? 0} receipts`}
          icon={Wallet}
        />
        <KpiCard
          title="Bank / UPI"
          value={formatCurrency(kpis?.bank?.amount)}
          sub={`${kpis?.bank?.count ?? 0} receipts`}
          icon={Building2}
        />
      </div>

      {analytics ? (
        <Card className="mb-4 border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Collection Insights (Filtered)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
              <p className="text-[11px] uppercase text-muted-foreground">Largest Donation</p>
              <p className="font-semibold">
                {analytics.largest_donation
                  ? `${formatCurrency(analytics.largest_donation.amount)} · ${analytics.largest_donation.donor_name}`
                  : '—'}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
              <p className="text-[11px] uppercase text-muted-foreground">Top Donor</p>
              <p className="font-semibold">
                {analytics.top_donor
                  ? `${analytics.top_donor.donor_name} · ${formatCurrency(analytics.top_donor.total_amount)}`
                  : '—'}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
              <p className="text-[11px] uppercase text-muted-foreground">Top Purpose</p>
              <p className="font-semibold">{analytics.top_purpose?.purpose || '—'}</p>
            </div>
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
              <p className="text-[11px] uppercase text-muted-foreground">Top Payment Mode</p>
              <p className="font-semibold">
                {analytics.top_payment_mode
                  ? formatPaymentMode(analytics.top_payment_mode.payment_mode)
                  : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Register Filters</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={() => setShowAdvancedFilters((v) => !v)}
            >
              {showAdvancedFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Advanced
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <form onSubmit={handleSearch} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search donor name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Input
              placeholder="Receipt number"
              value={receiptSearch}
              onChange={(e) => {
                setReceiptSearch(e.target.value)
                setPage(1)
              }}
            />
            <Button type="submit" variant="secondary">
              Apply Search
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {Object.entries(shortcuts).map(([key, s]) => (
              <Button key={key} type="button" variant="outline" size="sm" onClick={() => applyShortcut(key)}>
                {s.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Mobile number"
              value={mobileFilter}
              onChange={(e) => {
                setMobileFilter(e.target.value)
                setPage(1)
              }}
            />
            <Select
              value={paymentMode}
              onValueChange={(v) => {
                setPaymentMode(v)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Payment mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modes</SelectItem>
                {PAYMENT_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatPaymentMode(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={receiptStatus}
              onValueChange={(v) => {
                setReceiptStatus(v)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Receipt status" />
              </SelectTrigger>
              <SelectContent>
                {RECEIPT_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={donorType}
              onValueChange={(v) => {
                setDonorType(v)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Donor type" />
              </SelectTrigger>
              <SelectContent>
                {DONOR_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showAdvancedFilters ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Input
                placeholder="Donation purpose"
                value={purposeFilter}
                onChange={(e) => {
                  setPurposeFilter(e.target.value)
                  setPage(1)
                }}
              />
              <Input
                type="number"
                placeholder="Min amount"
                value={minAmount}
                onChange={(e) => {
                  setMinAmount(e.target.value)
                  setPage(1)
                }}
              />
              <Input
                type="number"
                placeholder="Max amount"
                value={maxAmount}
                onChange={(e) => {
                  setMaxAmount(e.target.value)
                  setPage(1)
                }}
              />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setPage(1)
                }}
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {data?.summary ? (
          <p className="text-sm text-muted-foreground">
            Filtered register: {formatCurrency(data.summary.totalAmount)} · {data.summary.totalCount} receipts · Avg{' '}
            {formatCurrency(data.summary.averageAmount)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Donation receipt register</p>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportExcel} disabled={exporting === 'excel'}>
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPdf} disabled={exporting === 'pdf'}>
              <FileText className="h-4 w-4" />
              Export PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              Print Register
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error?.message}</AlertDescription>
        </Alert>
      )}

      <Card ref={printRef} className="print:border-0 print:shadow-none">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <TableLoadingSkeleton rows={8} />
          ) : !data?.donations?.length ? (
            <EmptyState
              title="No donations in register"
              description="Adjust filters or record a new donation."
              className="px-4"
            />
          ) : (
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 py-2 text-[11px]">Receipt</TableHead>
                  <TableHead className="h-9 py-2 text-[11px]">Date</TableHead>
                  <TableHead className="h-9 py-2 text-[11px]">Donor & Contact</TableHead>
                  <TableHead className="h-9 py-2 text-[11px]">Purpose</TableHead>
                  <TableHead className="h-9 py-2 text-[11px]">Mode</TableHead>
                  <TableHead className="h-9 py-2 text-right text-[11px]">Amount</TableHead>
                  <TableHead className="h-9 py-2 text-[11px]">Status</TableHead>
                  <TableHead className="h-9 w-12 py-2 text-right text-[11px] print:hidden"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.donations.map((d) => (
                  <TableRow key={d.id} className="hover:bg-muted/30">
                    <TableCell className="py-2 align-middle">
                      <button
                        type="button"
                        className="max-w-[120px] truncate font-mono text-[11px] text-saffron-dark hover:underline"
                        title={d.receipt_number}
                        onClick={() => setDetailId(d.id)}
                      >
                        {d.receipt_number}
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-2 align-middle text-xs text-muted-foreground">
                      {formatDate(d.donation_date)}
                    </TableCell>
                    <TableCell className="py-2 align-middle">
                      <DonorRegisterCell donation={d} onOpen={() => setDetailId(d.id)} />
                    </TableCell>
                    <TableCell className="max-w-[160px] py-2 align-middle">
                      <span className="line-clamp-1 text-sm" title={d.purpose}>
                        {d.purpose}
                      </span>
                      {d.notes ? (
                        <span className="line-clamp-1 text-[10px] text-muted-foreground" title={d.notes}>
                          {d.notes}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-2 align-middle text-xs">
                      {formatPaymentMode(d.payment_mode)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-2 text-right align-middle font-semibold tabular-nums">
                      {formatCurrency(d.amount)}
                    </TableCell>
                    <TableCell className="py-2 align-middle">
                      <ReceiptStatusCompact statuses={d.receipt_statuses} />
                    </TableCell>
                    <TableCell className="py-2 text-right align-middle print:hidden">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Donation actions">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => setDetailId(d.id)}>
                            <Eye className="h-4 w-4" />
                            View Donation
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(d)}>
                            <Pencil className="h-4 w-4" />
                            Edit Donation
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleReceipt(d)}>
                            <Download className="h-4 w-4" />
                            Download Receipt
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleWhatsApp(d.id)}>
                            <MessageCircle className="h-4 w-4" />
                            Send WhatsApp Receipt
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              toast({
                                title: 'Email receipt',
                                description: 'Configure SMTP in trust settings to enable email delivery.',
                              })
                            }
                          >
                            <Mail className="h-4 w-4" />
                            Send Email Receipt
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRegenerate(d.id)}>
                            <RefreshCw className="h-4 w-4" />
                            Regenerate Receipt
                          </DropdownMenuItem>
                          {isAdmin ? (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setPendingDeleteId(d.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="print:hidden">
        <PaginationBar pagination={data?.pagination} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground print:hidden">
        Row indicators: <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> high value</span>
        {' · '}
        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> PAN</span>
        {' · '}
        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> verify</span>
        {' · '}Status “+N” = additional receipt events (open row for full detail).
      </p>

      <DonationDetailsDrawer donationId={detailId} open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)} />

      <Dialog open={!!editDonation} onOpenChange={(open) => !open && setEditDonation(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Donation</DialogTitle>
            <DialogDescription>{editDonation?.receipt_number}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Donor name</Label>
              <Input value={editForm.donor_name} onChange={(e) => setEditForm({ ...editForm, donor_name: e.target.value })} />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input value={editForm.donor_mobile} onChange={(e) => setEditForm({ ...editForm, donor_mobile: e.target.value })} />
            </div>
            <div>
              <Label>City</Label>
              <Input value={editForm.donor_city} onChange={(e) => setEditForm({ ...editForm, donor_city: e.target.value })} />
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                min={0.01}
                max={MAX_AMOUNT}
                step="0.01"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
              />
            </div>
            <div>
              <Label>Purpose</Label>
              <Input value={editForm.purpose} onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })} />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                max={todayISO()}
                value={editForm.donation_date}
                onChange={(e) => setEditForm({ ...editForm, donation_date: e.target.value })}
              />
            </div>
            <div>
              <Label>PAN (optional)</Label>
              <Input value={editForm.pan_number} onChange={(e) => setEditForm({ ...editForm, pan_number: e.target.value })} />
            </div>
            <Button onClick={saveEdit} disabled={updateMutation.isPending}>
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete donation?"
        description="This will soft delete the donation and hide it from the register."
        confirmText="Delete donation"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
