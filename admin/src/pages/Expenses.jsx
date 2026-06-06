import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Trash2, Download, Printer, FileText, MoreVertical, FileSpreadsheet, FileDown, Paperclip, ShieldCheck, ShieldAlert, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import HeaderIconButton from '@/components/layout/HeaderIconButton'
import FilterToolbar from '@/components/common/FilterToolbar'
import CompactStatCard from '@/components/common/CompactStatCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import ConfirmActionDialog from '@/components/common/ConfirmActionDialog'
import RequiredLabel from '@/components/common/RequiredLabel'
import FormDialogFooter from '@/components/common/FormDialogFooter'
import VendorExactMatchBanner from '@/components/common/VendorExactMatchBanner'
import EmptyState from '@/components/common/EmptyState'
import PaginationBar from '@/components/common/PaginationBar'
import TableLoadingSkeleton from '@/components/common/TableLoadingSkeleton'
import { useExpenses, useCreateExpense, useDeleteExpense, useUpdateExpense, downloadExpenseVoucherPdf, fetchExpenseVoucherBlob } from '@/hooks/useExpenses'
import { useVendors, useCreateVendor } from '@/hooks/useVendors'
import { formatCurrency, formatDate, formatExpenseCategory, formatExpenseParticulars, EXPENSE_CATEGORIES, todayISO } from '@/utils/formatters'
import { getApiErrorMessage } from '@/lib/api'
import {
  validateExpenseForm,
  confirmBackdatedEntry,
  confirmDuplicateVoucher,
  natureForExpenseCategory,
  parseAmount,
  formatAttachmentHint,
  HIGH_VALUE_ATTACHMENT_THRESHOLD,
  PAYEE_AMOUNT_THRESHOLD,
  findExactVendorMatch,
  isVendorLinked,
  normalizeVendorMobile,
  normalizeVendorName,
} from '@/lib/formHelpers'
import { toast } from '@/hooks/use-toast'
import { useAuthStore } from '@/store/useAuthStore'
import api from '@/lib/api'

const MAX_AMOUNT = 99_999_999.99
const EXPENSE_NATURE_OPTIONS = [
  { value: 'OPERATIONAL', label: 'Operational' },
  { value: 'RELIGIOUS', label: 'Religious' },
  { value: 'CONSTRUCTION', label: 'Construction' },
  { value: 'ADMINISTRATIVE', label: 'Administrative' },
  { value: 'WELFARE', label: 'Welfare' },
  { value: 'OTHER', label: 'Other' },
]
const PAYMENT_MODE_OPTIONS = ['CASH', 'UPI', 'CHEQUE', 'NEFT', 'RTGS', 'DD', 'ONLINE']
const BANK_MODES = new Set(['NEFT', 'RTGS', 'ONLINE', 'DD'])

function formatSelectedPeriodLabel(selectedPeriod) {
  if (!selectedPeriod?.period) return ''
  const period = String(selectedPeriod.period).toUpperCase()
  const from = selectedPeriod.date_from ? new Date(selectedPeriod.date_from) : null
  const to = selectedPeriod.date_to ? new Date(selectedPeriod.date_to) : null

  if (period === 'MONTHLY' && from && !Number.isNaN(from.getTime())) {
    return from.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  }
  if (period === 'QUARTERLY' && from && !Number.isNaN(from.getTime())) {
    const quarter = Math.floor(from.getMonth() / 3) + 1
    return `Q${quarter} ${from.getFullYear()}`
  }
  if (period === 'YEARLY' && from && !Number.isNaN(from.getTime())) {
    return `${from.getFullYear()}`
  }
  if (period === 'CUSTOM' && from && to && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
    const fromLabel = from.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    const toLabel = to.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    return `${fromLabel} to ${toLabel}`
  }
  return selectedPeriod.label || period
}

export default function Expenses() {
  const [searchParams] = useSearchParams()
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN')
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('MONTHLY')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [expenseNature, setExpenseNature] = useState('all')
  const [paymentModeFilter, setPaymentModeFilter] = useState('all')
  const [verificationStatus, setVerificationStatus] = useState('all')
  const [attachmentStatus, setAttachmentStatus] = useState('all')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [previewExpense, setPreviewExpense] = useState(null)
  const [vendorSearch, setVendorSearch] = useState('')
  const [editVendorSearch, setEditVendorSearch] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(null)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [form, setForm] = useState({
    expense_date: todayISO(),
    category: 'OTHER',
    expense_nature: 'OPERATIONAL',
    amount: '',
    description: '',
    paid_to: '',
    vendor_mobile: '',
    payment_mode: 'CASH',
    upi_ref: '',
    cheque_number: '',
    transaction_id: '',
    reference: '',
    notes: '',
    vendor_id: '',
    attachment: null,
    payment_channel: 'CASH',
  })
  const paymentMode = form.payment_mode
  const paymentChannel = useMemo(() => (paymentMode === 'CASH' ? 'CASH' : 'BANK'), [paymentMode])
  const [editForm, setEditForm] = useState({
    expense_date: todayISO(),
    category: 'OTHER',
    expense_nature: 'OPERATIONAL',
    amount: '',
    description: '',
    paid_to: '',
    vendor_mobile: '',
    payment_mode: 'CASH',
    upi_ref: '',
    cheque_number: '',
    transaction_id: '',
    reference: '',
    notes: '',
    vendor_id: '',
    payment_channel: 'CASH',
  })
  const editPaymentMode = editForm.payment_mode
  const editPaymentChannel = useMemo(() => (editPaymentMode === 'CASH' ? 'CASH' : 'BANK'), [editPaymentMode])
  const periodParam = period === 'CUSTOM' && (!customFrom || !customTo) ? 'MONTHLY' : period

  const params = {
    page,
    limit: 25,
    ...(category && { category }),
    ...(search && { search }),
    ...(periodParam && { period: periodParam }),
    ...(period === 'CUSTOM' && customFrom && { date_from: customFrom }),
    ...(period === 'CUSTOM' && customTo && { date_to: customTo }),
    ...(expenseNature !== 'all' && { expense_nature: expenseNature }),
    ...(paymentModeFilter !== 'all' && { payment_mode: paymentModeFilter }),
    ...(verificationStatus !== 'all' && { verification_status: verificationStatus }),
    ...(attachmentStatus !== 'all' && { attachment_status: attachmentStatus }),
    ...(minAmount && { amount_min: minAmount }),
    ...(maxAmount && { amount_max: maxAmount }),
  }
  const { data, isLoading, isError, error } = useExpenses(params)
  const selectedPeriodLabel = formatSelectedPeriodLabel(data?.selected_period)
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()
  const vendorsQuery = useVendors(vendorSearch)
  const editVendorsQuery = useVendors(editVendorSearch)
  const vendorsDirectoryQuery = useVendors('', { enabled: addOpen })
  const editVendorsDirectoryQuery = useVendors('', { enabled: editOpen })
  const createVendor = useCreateVendor()
  const totalAmount = Number(data?.summary?.total_amount || 0)
  const topHead = data?.by_category?.[0]
  const insights = useMemo(() => {
    if (!data?.summary) return []
    const list = []
    if (topHead && totalAmount > 0) {
      const pct = Math.round((Number(topHead.total_amount) / totalAmount) * 100)
      list.push(`${topHead.label} accounts for ${pct}% of total expenditure.`)
    }
    if (data.summary.pending_verification_count > 0) {
      list.push(`${data.summary.pending_verification_count} vouchers are pending verification.`)
    } else {
      list.push('All vouchers in the current register are verified.')
    }
    if (data.summary.missing_attachment_count > 0) {
      list.push(`${data.summary.missing_attachment_count} vouchers are missing supporting bills.`)
    } else {
      list.push('All vouchers have supporting documentation attached.')
    }
    if (Number(data.summary.cash_total || 0) > Number(data.summary.bank_total || 0)) {
      list.push('Cash expenses currently dominate register outflow.')
    } else if (Number(data.summary.bank_total || 0) > 0) {
      list.push('Bank payments currently dominate register outflow.')
    }
    if (data.summary.high_value_count > 0 && data.summary.pending_verification_count > 0) {
      list.push('Unverified high-value vouchers require immediate review.')
    }
    return list.slice(0, 3)
  }, [data?.summary, topHead, totalAmount])

  useEffect(() => {
    const initialSearch = searchParams.get('search') || ''
    if (initialSearch) {
      setSearch(initialSearch)
      setPage(1)
    }
  }, [searchParams])

  const createExactVendorMatch = useMemo(
    () => findExactVendorMatch(vendorsDirectoryQuery.data, form.paid_to, form.vendor_mobile),
    [vendorsDirectoryQuery.data, form.paid_to, form.vendor_mobile]
  )
  const editExactVendorMatch = useMemo(
    () => findExactVendorMatch(editVendorsDirectoryQuery.data, editForm.paid_to, editForm.vendor_mobile),
    [editVendorsDirectoryQuery.data, editForm.paid_to, editForm.vendor_mobile]
  )

  useEffect(() => {
    if (!form.vendor_id || !vendorsDirectoryQuery.data?.length) return
    const linked = vendorsDirectoryQuery.data.find((v) => v.id === form.vendor_id)
    if (!linked) return
    if (
      normalizeVendorName(linked.name) !== normalizeVendorName(form.paid_to) ||
      normalizeVendorMobile(linked.mobile) !== normalizeVendorMobile(form.vendor_mobile)
    ) {
      setForm((prev) => ({ ...prev, vendor_id: '' }))
    }
  }, [form.paid_to, form.vendor_mobile, form.vendor_id, vendorsDirectoryQuery.data])

  useEffect(() => {
    if (!editForm.vendor_id || !editVendorsDirectoryQuery.data?.length) return
    const linked = editVendorsDirectoryQuery.data.find((v) => v.id === editForm.vendor_id)
    if (!linked) return
    if (
      normalizeVendorName(linked.name) !== normalizeVendorName(editForm.paid_to) ||
      normalizeVendorMobile(linked.mobile) !== normalizeVendorMobile(editForm.vendor_mobile)
    ) {
      setEditForm((prev) => ({ ...prev, vendor_id: '' }))
    }
  }, [editForm.paid_to, editForm.vendor_mobile, editForm.vendor_id, editVendorsDirectoryQuery.data])

  const applyExistingVendorToCreate = (vendor) => {
    setForm((prev) => ({
      ...prev,
      vendor_id: vendor.id,
      paid_to: vendor.name || prev.paid_to,
      vendor_mobile: vendor.mobile || prev.vendor_mobile,
    }))
    setVendorSearch(vendor.name || '')
    toast({ title: 'Existing vendor selected', description: `${vendor.name} linked to this voucher.` })
  }

  const applyExistingVendorToEdit = (vendor) => {
    setEditForm((prev) => ({
      ...prev,
      vendor_id: vendor.id,
      paid_to: vendor.name || prev.paid_to,
      vendor_mobile: vendor.mobile || prev.vendor_mobile,
    }))
    setEditVendorSearch(vendor.name || '')
    toast({ title: 'Existing vendor selected', description: `${vendor.name} linked to this voucher.` })
  }

  const handleCreate = async () => {
    const issues = validateExpenseForm(form, form.payment_mode)
    if (issues.length) {
      toast({ title: 'Check form', description: issues[0].message, variant: 'destructive' })
      return
    }
    if (!confirmBackdatedEntry(form.expense_date)) return
    const amount = parseAmount(form.amount)
    if (amount >= HIGH_VALUE_ATTACHMENT_THRESHOLD && !form.attachment) {
      if (!window.confirm(`No bill attached for ${formatCurrency(amount)}. Save anyway?`)) return
    }
    await submitCreate(false)
  }

  const submitCreate = async (confirmDuplicate = false) => {
    try {
      const payload = new FormData()
      payload.append('expense_date', form.expense_date)
      payload.append('category', form.category)
      payload.append('expense_nature', form.expense_nature)
      payload.append('amount', String(parseAmount(form.amount)))
      payload.append('description', form.description || '')
      payload.append('paid_to', form.paid_to)
      payload.append('vendor_mobile', form.vendor_mobile)
      payload.append('payment_mode', form.payment_mode)
      payload.append('payment_channel', paymentChannel)
      payload.append('reference', form.reference)
      payload.append('notes', form.notes)
      if (form.vendor_id) payload.append('vendor_id', form.vendor_id)
      if (form.upi_ref) payload.append('upi_ref', form.upi_ref)
      if (form.cheque_number) payload.append('cheque_number', form.cheque_number)
      if (form.transaction_id) payload.append('transaction_id', form.transaction_id)
      if (form.attachment) payload.append('attachment', form.attachment)
      if (confirmDuplicate) payload.append('confirm_duplicate', 'true')

      const result = await createExpense.mutateAsync(payload)
      toast({ title: 'Expense voucher recorded' })
      if (result?.warning?.message) {
        toast({ title: 'Balance warning', description: result.warning.message })
      }
      setSaveSuccess(result.expense)
      setForm({
        expense_date: todayISO(),
        category: 'OTHER',
        expense_nature: 'OPERATIONAL',
        amount: '',
        description: '',
        paid_to: '',
        vendor_mobile: '',
        payment_mode: 'CASH',
        upi_ref: '',
        cheque_number: '',
        transaction_id: '',
        reference: '',
        notes: '',
        vendor_id: '',
        attachment: null,
        payment_channel: 'CASH',
      })
    } catch (err) {
      const code = err?.response?.data?.code
      if (code === 'DUPLICATE_VOUCHER') {
        if (confirmDuplicateVoucher(getApiErrorMessage(err))) {
          await submitCreate(true)
        }
        return
      }
      toast({ title: 'Failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleVoucherDownload = async (expense) => {
    try {
      await downloadExpenseVoucherPdf(expense.id, expense.voucher_number)
    } catch (err) {
      toast({ title: 'Download failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleVoucherPrint = async (expense) => {
    try {
      const blob = await fetchExpenseVoucherBlob(expense.id)
      const url = window.URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (win) {
        win.focus()
        setTimeout(() => win.print(), 700)
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      toast({ title: 'Print failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleVoucherView = async (expense) => {
    try {
      const blob = await fetchExpenseVoucherBlob(expense.id)
      const url = window.URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (!win) {
        toast({
          title: 'Popup blocked',
          description: 'Please allow popups to view voucher preview.',
          variant: 'destructive',
        })
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      toast({ title: 'View failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleDelete = async (id) => {
    setPendingDeleteId(id)
  }

  const openEditVoucher = (expense) => {
    setEditingExpense(expense)
    setEditForm({
      expense_date: expense.expense_date ? new Date(expense.expense_date).toISOString().slice(0, 10) : todayISO(),
      category: expense.category || 'OTHER',
      expense_nature: expense.expense_nature || 'OPERATIONAL',
      amount: String(Number(expense.amount || 0)),
      description: expense.description || '',
      paid_to: expense.paid_to || '',
      vendor_mobile: expense.vendor_mobile || '',
      payment_mode: expense.payment_mode || 'CASH',
      upi_ref: expense.upi_ref || '',
      cheque_number: expense.cheque_number || '',
      transaction_id: expense.transaction_id || '',
      reference: expense.reference || '',
      notes: expense.notes || '',
      vendor_id: expense.vendor_id || '',
      payment_channel: expense.payment_channel || 'CASH',
    })
    setEditOpen(true)
  }

  const handleUpdateVoucher = async () => {
    if (!editingExpense) return
    const issues = validateExpenseForm(editForm, editForm.payment_mode)
    if (issues.length) {
      toast({ title: 'Check form', description: issues[0].message, variant: 'destructive' })
      return
    }
    if (!confirmBackdatedEntry(editForm.expense_date)) return
    try {
      await updateExpense.mutateAsync({
        id: editingExpense.id,
        payload: {
          ...editForm,
          amount: parseAmount(editForm.amount),
          description: editForm.description || '',
          payment_channel: editPaymentChannel,
          vendor_id: editForm.vendor_id || undefined,
        },
      })
      toast({
        title: 'Voucher updated',
        description: 'Changes saved and recorded in audit logs.',
      })
      setEditOpen(false)
      setEditingExpense(null)
    } catch (err) {
      toast({ title: 'Update failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const getVoucherNumber = (expense) => {
    if (expense.voucher_number) return expense.voucher_number
    const year = new Date(expense.expense_date || Date.now()).getFullYear()
    return `TVT-EXP-${year}-${String(expense.id || '').slice(-6).toUpperCase().padStart(6, '0')}`
  }

  const resetFilters = () => {
    setPeriod('MONTHLY')
    setCustomFrom('')
    setCustomTo('')
    setExpenseNature('all')
    setPaymentModeFilter('all')
    setVerificationStatus('all')
    setAttachmentStatus('all')
    setMinAmount('')
    setMaxAmount('')
    setCategory('')
    setSearch('')
    setPage(1)
  }

  const handleSaveVendorFromCreate = async () => {
    try {
      if (!form.paid_to?.trim()) {
        toast({ title: 'Vendor name required', description: 'Enter vendor/payee name before saving.', variant: 'destructive' })
        return
      }
      if (!form.vendor_mobile?.trim()) {
        toast({ title: 'Mobile required', description: 'Enter mobile number to save or match a vendor.', variant: 'destructive' })
        return
      }
      const existing = findExactVendorMatch(vendorsDirectoryQuery.data, form.paid_to, form.vendor_mobile)
      if (existing) {
        const useExisting = window.confirm(
          `A vendor named "${existing.name}" with mobile ${existing.mobile} is already saved. Use the existing record?`
        )
        if (useExisting) {
          applyExistingVendorToCreate(existing)
          return
        }
      }
      const vendor = await createVendor.mutateAsync({
        name: form.paid_to.trim(),
        mobile: form.vendor_mobile || undefined,
      })
      setForm((prev) => ({ ...prev, vendor_id: vendor.id }))
      toast({ title: 'Vendor saved', description: `${vendor.name} added to vendor directory.` })
    } catch (err) {
      toast({ title: 'Failed to save vendor', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleSaveVendorFromEdit = async () => {
    try {
      if (!editForm.paid_to?.trim()) {
        toast({ title: 'Vendor name required', description: 'Enter vendor/payee name before saving.', variant: 'destructive' })
        return
      }
      if (!editForm.vendor_mobile?.trim()) {
        toast({ title: 'Mobile required', description: 'Enter mobile number to save or match a vendor.', variant: 'destructive' })
        return
      }
      const existing = findExactVendorMatch(editVendorsDirectoryQuery.data, editForm.paid_to, editForm.vendor_mobile)
      if (existing) {
        const useExisting = window.confirm(
          `A vendor named "${existing.name}" with mobile ${existing.mobile} is already saved. Use the existing record?`
        )
        if (useExisting) {
          applyExistingVendorToEdit(existing)
          return
        }
      }
      const vendor = await createVendor.mutateAsync({
        name: editForm.paid_to.trim(),
        mobile: editForm.vendor_mobile || undefined,
      })
      setEditForm((prev) => ({ ...prev, vendor_id: vendor.id }))
      toast({ title: 'Vendor saved', description: `${vendor.name} added to vendor directory.` })
    } catch (err) {
      toast({ title: 'Failed to save vendor', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const exportRegisterCsv = async () => {
    try {
      const { data: exportData } = await api.get('/expenses', { params: { ...params, page: 1, limit: 1000 } })
      const rows = exportData.expenses || []
      const header = [
        'Voucher Date',
        'Voucher Number',
        'Expense Category',
        'Expense Nature',
        'Expense Particulars',
        'Vendor/Payee',
        'Payment Account',
        'Payment Mode',
        'Reference',
        'Amount',
        'Verification Status',
        'Attachment Status',
      ]
      const csvRows = rows.map((e) =>
        [
          formatDate(e.expense_date),
          getVoucherNumber(e),
          formatExpenseCategory(e.category),
          e.expense_nature || '-',
          formatExpenseParticulars(e).replace(/"/g, '""'),
          (e.paid_to || '-').replace(/"/g, '""'),
          e.payment_channel || '-',
          e.payment_mode || '-',
          e.transaction_id || e.upi_ref || e.cheque_number || e.reference || '-',
          Number(e.amount || 0).toFixed(2),
          e.is_reconciled ? 'Verified' : 'Pending Verification',
          e.attachment_url ? 'Bill Attached' : 'Missing Attachment',
        ]
          .map((value) => `"${value}"`)
          .join(',')
      )
      const csv = [header.join(','), ...csvRows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `expense-voucher-register-${todayISO()}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast({ title: 'Export failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const printRegister = (label = 'print') => {
    const rows = data?.expenses || []
    const content = `
      <html><head><title>Expense Voucher Register</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#111827}
        h1{margin:0 0 4px 0;font-size:20px} p{margin:0 0 14px 0;color:#4b5563}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #d1d5db;padding:7px 8px;text-align:left}
        th{background:#f3f4f6}
      </style></head><body>
      <h1>Expense Voucher Register</h1>
      <p>${data?.summary?.financial_year || ''} | Exported on ${new Date().toLocaleString('en-IN')}</p>
      <table>
      <thead><tr><th>Date</th><th>Voucher No.</th><th>Expense Particulars</th><th>Payee</th><th>Payment Account</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody>
      ${rows
        .map(
          (e) =>
            `<tr><td>${formatDate(e.expense_date)}</td><td>${getVoucherNumber(e)}</td><td>${formatExpenseParticulars(e)}</td><td>${e.paid_to || '-'}</td><td>${e.payment_channel || '-'}</td><td>${formatCurrency(e.amount)}</td><td>${e.is_reconciled ? 'Verified' : 'Pending Verification'}</td></tr>`
        )
        .join('')}
      </tbody></table></body></html>
    `
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(content)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 350)
    if (label === 'pdf') {
      toast({ title: 'Export PDF', description: 'Choose "Save as PDF" in print dialog.' })
    }
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    try {
      await deleteExpense.mutateAsync(pendingDeleteId)
      toast({ title: 'Expense deleted' })
      setPendingDeleteId(null)
    } catch (err) {
      toast({ title: 'Failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const createPayeeRequired =
    parseAmount(form.amount) >= PAYEE_AMOUNT_THRESHOLD || (form.payment_mode && form.payment_mode !== 'CASH')
  const editPayeeRequired =
    parseAmount(editForm.amount) >= PAYEE_AMOUNT_THRESHOLD ||
    (editForm.payment_mode && editForm.payment_mode !== 'CASH')

  return (
    <>
      <PageHeader
        title="Expense Vouchers"
        mobileTitle="Expenses"
        description="Track trust expenditure through structured voucher records"
        mobileAction={
          <HeaderIconButton icon={Plus} label="Record expense voucher" onClick={() => setAddOpen(true)} />
        }
      >
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Record Expense Voucher
        </Button>
      </PageHeader>

      <FilterToolbar>
        <Input className="h-9" placeholder="Search voucher no., payee, particulars or reference..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        <Select value={category || 'all'} onValueChange={(v) => { setCategory(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(v) => { setPeriod(v); setPage(1) }}>
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
            <Input className="h-9" type="date" value={customFrom} max={customTo || todayISO()} onChange={(e) => { setCustomFrom(e.target.value); setPage(1) }} aria-label="Date from" />
            <Input className="h-9" type="date" value={customTo} min={customFrom || undefined} max={todayISO()} onChange={(e) => { setCustomTo(e.target.value); setPage(1) }} aria-label="Date to" />
          </>
        ) : null}
        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between lg:col-span-4">
          <Button variant="ghost" size="sm" className="w-full justify-start sm:w-auto" onClick={() => setShowAdvancedFilters((v) => !v)}>
            {showAdvancedFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Advanced Filters
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={resetFilters}>Reset Filters</Button>
        </div>
        {showAdvancedFilters ? (
          <>
            <Select value={expenseNature} onValueChange={(v) => { setExpenseNature(v); setPage(1) }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Expense nature" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All natures</SelectItem>
                {EXPENSE_NATURE_OPTIONS.map((n) => (
                  <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={paymentModeFilter} onValueChange={(v) => { setPaymentModeFilter(v); setPage(1) }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Payment mode" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payment modes</SelectItem>
                {PAYMENT_MODE_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={verificationStatus} onValueChange={(v) => { setVerificationStatus(v); setPage(1) }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Verification status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All verification statuses</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
                <SelectItem value="PENDING">Pending verification</SelectItem>
              </SelectContent>
            </Select>
            <Select value={attachmentStatus} onValueChange={(v) => { setAttachmentStatus(v); setPage(1) }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Attachment status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All attachment statuses</SelectItem>
                <SelectItem value="ATTACHED">Bill attached</SelectItem>
                <SelectItem value="MISSING">Missing attachment</SelectItem>
              </SelectContent>
            </Select>
            <Input className="h-9" placeholder="Min amount" type="number" min="0" value={minAmount} onChange={(e) => { setMinAmount(e.target.value); setPage(1) }} />
            <Input className="h-9" placeholder="Max amount" type="number" min="0" value={maxAmount} onChange={(e) => { setMaxAmount(e.target.value); setPage(1) }} />
          </>
        ) : null}
      </FilterToolbar>

      {data?.summary && (
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {data.summary.financial_year}
          {selectedPeriodLabel ? ` · ${selectedPeriodLabel}` : ''}
        </div>
      )}

      {data?.summary && (
      <div className="mb-3 grid grid-cols-2 gap-2 xl:grid-cols-5">
          <CompactStatCard label="Total Expenditure" value={formatCurrency(data.summary.total_amount)} valueClassName="text-maroon" sub={`${data.summary.expense_count} Vouchers`} />
          <CompactStatCard label="This Month" value={formatCurrency(data.summary.this_month_amount)} />
          <CompactStatCard label="Largest Head" value={data.summary.largest_head || '—'} valueClassName="text-sm font-semibold" />
          <CompactStatCard label="Cash Payments" value={formatCurrency(data.summary.cash_total)} />
          <CompactStatCard
            className="col-span-2 xl:col-span-1"
            label="Verification Status"
            shortLabel="Verification"
            value={data.summary.pending_verification_count > 0 ? `${data.summary.pending_verification_count} Pending` : 'All Verified'}
            valueClassName="text-sm font-semibold"
            sub={`${data.summary.missing_attachment_count} Missing Attachments`}
          />
        </div>
      )}

      {data?.by_category?.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
          {data.by_category.map((c) => (
            <Card key={c.category} className="border-muted/70">
              <CardHeader className="py-2">
                <CardTitle className="text-xs font-semibold">{c.label}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3">
                <p className="font-bold text-maroon">{formatCurrency(c.total_amount)}</p>
                <p className="text-[11px] text-muted-foreground">{c.count} Voucher{c.count > 1 ? 's' : ''}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {totalAmount > 0 ? `${Math.round((Number(c.total_amount) / totalAmount) * 100)}% of Total Expenditure` : 'Minor Operational Expense'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mb-2 flex flex-col gap-2 rounded-md border bg-muted/20 p-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-[260px] flex-1">
          {insights.length > 0 ? (
            <>
              <div className="mb-1 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-700" />
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">Operational Insights</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {insights.slice(0, 2).map((insight) => (
                  <span key={insight} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900">
                    {insight}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No operational alerts for current filters.</p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => printRegister('pdf')}>
            <FileDown className="h-4 w-4" />
            Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportRegisterCsv}>
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => printRegister('print')}>
            <Printer className="h-4 w-4" />
            Print Register
          </Button>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error?.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="max-h-[68vh] overflow-auto p-0">
          {isLoading ? (
            <TableLoadingSkeleton rows={6} />
          ) : !data?.expenses?.length ? (
            <EmptyState
              title="No expenses found"
              description="Record an expense or clear filters to view data."
              className="px-4"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voucher Date</TableHead>
                  <TableHead className="w-[180px]">Voucher No.</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Expense Nature</TableHead>
                  <TableHead>Expense Particulars</TableHead>
                  <TableHead>Vendor / Payee</TableHead>
                  <TableHead>Payment Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.expenses.map((e) => (
                  <TableRow key={e.id} className="odd:bg-muted/20 hover:bg-muted/40">
                    <TableCell className="py-2 text-xs">{formatDate(e.expense_date)}</TableCell>
                    <TableCell className="py-2">
                      <button
                        type="button"
                        onClick={() => setPreviewExpense(e)}
                        className="whitespace-nowrap font-mono text-xs font-semibold text-maroon hover:underline"
                      >
                        {getVoucherNumber(e)}
                      </button>
                    </TableCell>
                    <TableCell className="py-2 text-xs">{formatExpenseCategory(e.category)}</TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">{e.expense_nature || '—'}</TableCell>
                    <TableCell className="max-w-[220px]">
                      <p className="truncate text-xs">{formatExpenseParticulars(e)}</p>
                      <p className="text-[11px] text-muted-foreground">{e.transaction_id || e.upi_ref || e.cheque_number || e.reference || 'No reference'}</p>
                      <p className="text-[11px] text-muted-foreground">Entered By: {e.entered_by || 'System'}</p>
                    </TableCell>
                    <TableCell className="py-2 text-xs font-medium">{e.paid_to || '—'}</TableCell>
                    <TableCell className="py-2 text-xs">{e.payment_channel || '—'}</TableCell>
                    <TableCell className="py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${e.is_reconciled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {e.is_reconciled ? 'Verified' : 'Pending Verification'}
                      </span>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] ${e.attachment_url ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                        <Paperclip className="h-3 w-3" />
                        {e.attachment_url ? 'Bill Attached' : 'Missing Bill'}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <p className="font-mono text-sm font-semibold">{formatCurrency(e.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">{Number(e.amount) >= 50000 ? 'High Value Expense' : 'Operational Expense'}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Voucher actions">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleVoucherView(e)}>
                            <FileText className="mr-2 h-4 w-4" /> View Voucher
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleVoucherDownload(e)}>
                            <Download className="mr-2 h-4 w-4" /> Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleVoucherPrint(e)}>
                            <Printer className="mr-2 h-4 w-4" /> Print Voucher
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditVoucher(e)}>
                            <FileText className="mr-2 h-4 w-4" /> Edit Voucher
                          </DropdownMenuItem>
                          {isAdmin ? (
                            <DropdownMenuItem onClick={() => handleDelete(e.id)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Voucher
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
          {data?.summary ? (
            <div className="border-t bg-muted/30 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Total Vouchers: <strong className="text-foreground">{data.summary.expense_count}</strong></span>
                <span className="text-muted-foreground">Total Expenditure: <strong className="text-foreground">{formatCurrency(data.summary.total_amount)}</strong></span>
                <span className="text-muted-foreground">Verified Expenses: <strong className="text-emerald-700">{formatCurrency(data.summary.verified_amount)}</strong></span>
                <span className="text-muted-foreground">Pending Verification: <strong className="text-amber-700">{formatCurrency(data.summary.pending_amount)}</strong></span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <PaginationBar
        pagination={data?.pagination}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Record Expense Voucher</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Record trust expenditure, payment details and supporting documents.
            </p>
          </DialogHeader>
          {!saveSuccess ? (
            <div className="grid gap-5">
              <div className="border-b pb-4">
                <p className="mb-3 text-sm font-semibold">Expense Details</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <RequiredLabel>Voucher Date</RequiredLabel>
                    <Input type="date" max={todayISO()} value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
                  </div>
                  <div>
                    <RequiredLabel>Expense Category</RequiredLabel>
                    <Select
                      value={form.category}
                      onValueChange={(v) =>
                        setForm({ ...form, category: v, expense_nature: natureForExpenseCategory(v) })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <RequiredLabel>Expense Nature</RequiredLabel>
                    <Select value={form.expense_nature} onValueChange={(v) => setForm({ ...form, expense_nature: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_NATURE_OPTIONS.map((n) => (
                          <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <RequiredLabel>Amount</RequiredLabel>
                    <Input type="number" min={0.01} max={MAX_AMOUNT} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                    {parseAmount(form.amount) > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(parseAmount(form.amount))}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="border-b pb-4">
                <p className="mb-3 text-sm font-semibold">Payment Information</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Paid Through</Label>
                    <Input value={paymentChannel} disabled />
                  </div>
                  <div>
                    <RequiredLabel>Payment Mode</RequiredLabel>
                    <Select value={form.payment_mode} onValueChange={(v) => setForm({ ...form, payment_mode: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_MODE_OPTIONS.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {paymentMode === 'UPI' ? (
                    <div className="sm:col-span-2">
                      <RequiredLabel>UPI Reference Number</RequiredLabel>
                      <Input value={form.upi_ref} onChange={(e) => setForm({ ...form, upi_ref: e.target.value })} />
                    </div>
                  ) : null}
                  {paymentMode === 'CHEQUE' ? (
                    <div className="sm:col-span-2">
                      <RequiredLabel>Cheque Number</RequiredLabel>
                      <Input value={form.cheque_number} onChange={(e) => setForm({ ...form, cheque_number: e.target.value })} />
                    </div>
                  ) : null}
                  {BANK_MODES.has(paymentMode) ? (
                    <div className="sm:col-span-2">
                      <RequiredLabel>Transaction ID</RequiredLabel>
                      <Input value={form.transaction_id} onChange={(e) => setForm({ ...form, transaction_id: e.target.value })} />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="border-b pb-4">
                <p className="mb-3 text-sm font-semibold">Vendor / Payee Information</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <RequiredLabel optional>Search Vendor Directory</RequiredLabel>
                    <Input
                      placeholder="Search saved vendors by name or mobile"
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                    />
                    {vendorSearch && vendorsQuery.data?.length ? (
                      <div className="mt-1 max-h-28 overflow-auto rounded-md border bg-background p-1">
                        {vendorsQuery.data.slice(0, 8).map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
                            onClick={() => {
                              setForm((prev) => ({
                                ...prev,
                                vendor_id: v.id,
                                paid_to: v.name || prev.paid_to,
                                vendor_mobile: v.mobile || prev.vendor_mobile,
                              }))
                              setVendorSearch(v.name)
                            }}
                          >
                            {v.name} {v.mobile ? `· ${v.mobile}` : ''}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <RequiredLabel optional={!createPayeeRequired}>Vendor / Payee Name</RequiredLabel>
                    <Input value={form.paid_to} onChange={(e) => setForm({ ...form, paid_to: e.target.value })} />
                  </div>
                  <div>
                    <RequiredLabel optional>Mobile Number</RequiredLabel>
                    <Input value={form.vendor_mobile} maxLength={10} onChange={(e) => setForm({ ...form, vendor_mobile: e.target.value })} />
                  </div>
                  <VendorExactMatchBanner
                    match={createExactVendorMatch}
                    linked={isVendorLinked(createExactVendorMatch, form.vendor_id)}
                    onUseExisting={applyExistingVendorToCreate}
                  />
                  <div className="sm:col-span-2 flex justify-end">
                    <Button type="button" size="sm" variant="outline" onClick={handleSaveVendorFromCreate} disabled={createVendor.isPending}>
                      {createVendor.isPending ? 'Saving Vendor...' : 'Save as Vendor'}
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold">Supporting Information</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <RequiredLabel optional>Description</RequiredLabel>
                    <Textarea className="min-h-[84px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div>
                    <RequiredLabel optional>Upload Bill / Supporting Document</RequiredLabel>
                    <Input type="file" accept=".pdf,image/*" onChange={(e) => setForm({ ...form, attachment: e.target.files?.[0] || null })} />
                    {form.attachment ? (
                      <p className="mt-1 text-xs text-muted-foreground">{formatAttachmentHint(form.attachment)}</p>
                    ) : parseAmount(form.amount) >= HIGH_VALUE_ATTACHMENT_THRESHOLD ? (
                      <p className="mt-1 text-xs text-amber-700">Recommended for amounts ₹5,000 and above</p>
                    ) : null}
                  </div>
                  <div>
                    <RequiredLabel optional>Additional Notes</RequiredLabel>
                    <Textarea className="min-h-[84px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                </div>
              </div>

              <FormDialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!form.amount || createExpense.isPending}>
                  {createExpense.isPending ? 'Saving Voucher...' : 'Save Voucher'}
                </Button>
              </FormDialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-800">Expense Voucher Recorded Successfully</p>
                <p className="mt-1 text-sm text-emerald-700">
                  Voucher Number: {saveSuccess.voucher_number || 'Generated'}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant="outline" onClick={() => handleVoucherView(saveSuccess)}>
                  <FileText className="h-4 w-4" />
                  View Voucher
                </Button>
                <Button variant="outline" onClick={() => handleVoucherDownload(saveSuccess)}>
                  <Download className="h-4 w-4" />
                  Download Voucher PDF
                </Button>
                <Button variant="outline" onClick={() => handleVoucherPrint(saveSuccess)}>
                  <Printer className="h-4 w-4" />
                  Print Voucher
                </Button>
                <Button
                  onClick={() => {
                    setSaveSuccess(null)
                    setForm({
                      expense_date: todayISO(),
                      category: 'OTHER',
                      expense_nature: 'OPERATIONAL',
                      amount: '',
                      description: '',
                      paid_to: '',
                      vendor_mobile: '',
                      payment_mode: 'CASH',
                      upi_ref: '',
                      cheque_number: '',
                      transaction_id: '',
                      reference: '',
                      notes: '',
                      vendor_id: '',
                      attachment: null,
                      payment_channel: 'CASH',
                    })
                  }}
                >
                  Record Another Expense
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Expense Voucher</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Update voucher details. All changes are tracked in audit records for compliance.
            </p>
          </DialogHeader>
          <div className="grid gap-5">
            <div className="border-b pb-4">
              <p className="mb-3 text-sm font-semibold">Expense Details</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <RequiredLabel>Voucher Date</RequiredLabel>
                  <Input type="date" max={todayISO()} value={editForm.expense_date} onChange={(e) => setEditForm({ ...editForm, expense_date: e.target.value })} />
                </div>
                <div>
                  <RequiredLabel>Expense Category</RequiredLabel>
                  <Select
                    value={editForm.category}
                    onValueChange={(v) =>
                      setEditForm({ ...editForm, category: v, expense_nature: natureForExpenseCategory(v) })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <RequiredLabel>Expense Nature</RequiredLabel>
                  <Select value={editForm.expense_nature} onValueChange={(v) => setEditForm({ ...editForm, expense_nature: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_NATURE_OPTIONS.map((n) => (
                        <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <RequiredLabel>Amount</RequiredLabel>
                  <Input type="number" min={0.01} max={MAX_AMOUNT} step="0.01" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
                  {parseAmount(editForm.amount) > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(parseAmount(editForm.amount))}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="border-b pb-4">
              <p className="mb-3 text-sm font-semibold">Payment Information</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Paid Through</Label>
                  <Input value={editPaymentChannel} disabled />
                </div>
                <div>
                  <RequiredLabel>Payment Mode</RequiredLabel>
                  <Select value={editForm.payment_mode} onValueChange={(v) => setEditForm({ ...editForm, payment_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODE_OPTIONS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {editPaymentMode === 'UPI' ? (
                  <div className="sm:col-span-2">
                    <RequiredLabel>UPI Reference Number</RequiredLabel>
                    <Input value={editForm.upi_ref} onChange={(e) => setEditForm({ ...editForm, upi_ref: e.target.value })} />
                  </div>
                ) : null}
                {editPaymentMode === 'CHEQUE' ? (
                  <div className="sm:col-span-2">
                    <RequiredLabel>Cheque Number</RequiredLabel>
                    <Input value={editForm.cheque_number} onChange={(e) => setEditForm({ ...editForm, cheque_number: e.target.value })} />
                  </div>
                ) : null}
                {BANK_MODES.has(editPaymentMode) ? (
                  <div className="sm:col-span-2">
                    <RequiredLabel>Transaction ID</RequiredLabel>
                    <Input value={editForm.transaction_id} onChange={(e) => setEditForm({ ...editForm, transaction_id: e.target.value })} />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-b pb-4">
              <p className="mb-3 text-sm font-semibold">Vendor / Payee Information</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <RequiredLabel optional>Search Vendor Directory</RequiredLabel>
                  <Input
                    placeholder="Search saved vendors by name or mobile"
                    value={editVendorSearch}
                    onChange={(e) => setEditVendorSearch(e.target.value)}
                  />
                  {editVendorSearch && editVendorsQuery.data?.length ? (
                    <div className="mt-1 max-h-28 overflow-auto rounded-md border bg-background p-1">
                      {editVendorsQuery.data.slice(0, 8).map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
                          onClick={() => {
                            setEditForm((prev) => ({
                              ...prev,
                              vendor_id: v.id,
                              paid_to: v.name || prev.paid_to,
                              vendor_mobile: v.mobile || prev.vendor_mobile,
                            }))
                            setEditVendorSearch(v.name)
                          }}
                        >
                          {v.name} {v.mobile ? `· ${v.mobile}` : ''}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div>
                  <RequiredLabel optional={!editPayeeRequired}>Vendor / Payee Name</RequiredLabel>
                  <Input value={editForm.paid_to} onChange={(e) => setEditForm({ ...editForm, paid_to: e.target.value })} />
                </div>
                <div>
                  <RequiredLabel optional>Mobile Number</RequiredLabel>
                  <Input value={editForm.vendor_mobile} maxLength={10} onChange={(e) => setEditForm({ ...editForm, vendor_mobile: e.target.value })} />
                </div>
                <VendorExactMatchBanner
                  match={editExactVendorMatch}
                  linked={isVendorLinked(editExactVendorMatch, editForm.vendor_id)}
                  onUseExisting={applyExistingVendorToEdit}
                />
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="button" size="sm" variant="outline" onClick={handleSaveVendorFromEdit} disabled={createVendor.isPending}>
                    {createVendor.isPending ? 'Saving Vendor...' : 'Save as Vendor'}
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold">Supporting Information</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <RequiredLabel optional>Expense Particulars</RequiredLabel>
                  <Textarea className="min-h-[84px]" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                </div>
                <div>
                  <RequiredLabel optional>Reference</RequiredLabel>
                  <Input value={editForm.reference} onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })} />
                </div>
                <div>
                  <RequiredLabel optional>Additional Notes</RequiredLabel>
                  <Textarea className="min-h-[84px]" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                </div>
              </div>
            </div>

            <FormDialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateVoucher} disabled={!editForm.amount || updateExpense.isPending}>
                {updateExpense.isPending ? 'Saving Changes...' : 'Save Voucher Changes'}
              </Button>
            </FormDialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewExpense} onOpenChange={(open) => !open && setPreviewExpense(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Voucher Quick Preview</DialogTitle>
          </DialogHeader>
          {previewExpense ? (
            <div className="grid gap-2 text-sm">
              <p><span className="text-muted-foreground">Voucher:</span> <span className="font-mono">{getVoucherNumber(previewExpense)}</span></p>
              <p><span className="text-muted-foreground">Category:</span> {formatExpenseCategory(previewExpense.category)}</p>
              <p><span className="text-muted-foreground">Particulars:</span> {formatExpenseParticulars(previewExpense)}</p>
              <p><span className="text-muted-foreground">Amount:</span> <span className="font-semibold">{formatCurrency(previewExpense.amount)}</span></p>
              <p><span className="text-muted-foreground">Reference:</span> {previewExpense.transaction_id || previewExpense.upi_ref || previewExpense.cheque_number || previewExpense.reference || '-'}</p>
              <p><span className="text-muted-foreground">Attachment:</span> {previewExpense.attachment_url ? 'Bill Attached' : 'Missing Bill'}</p>
              <p><span className="text-muted-foreground">Entered By:</span> {previewExpense.entered_by || 'System'}</p>
              <p className="flex items-center gap-1"><span className="text-muted-foreground">Verification:</span> {previewExpense.is_reconciled ? <><ShieldCheck className="h-4 w-4 text-emerald-600" /> Verified</> : <><ShieldAlert className="h-4 w-4 text-amber-600" /> Pending</>}</p>
              <p><span className="text-muted-foreground">Created:</span> {formatDate(previewExpense.created_at)}</p>
              {previewExpense.verification_date ? (
                <p><span className="text-muted-foreground">Verified On:</span> {formatDate(previewExpense.verification_date)} {previewExpense.verified_by ? `by ${previewExpense.verified_by}` : ''}</p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete expense?"
        description="This permanently removes the selected expense record."
        confirmText="Delete expense"
        loading={deleteExpense.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
