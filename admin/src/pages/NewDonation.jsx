import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateDonation } from '@/hooks/useDonations'
import { useStockItems, useCreateInKindReceipt, useCreateStockItem } from '@/hooks/useInKind'
import {
  useCommitmentMembers,
  useEnrollMember,
  useLifetimePlan,
} from '@/hooks/useCommitments'
import { formatCurrency, formatPaymentMode, todayISO } from '@/utils/formatters'
import api, { getApiErrorMessage } from '@/lib/api'
import { validateDonationPaymentRefs, confirmBackdatedEntry } from '@/lib/formHelpers'
import RequiredLabel from '@/components/common/RequiredLabel'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

const MAX_AMOUNT = 99_999_999.99
const DONOR_TYPE_OPTIONS = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'TRUST_NGO', label: 'Trust/NGO' },
  { value: 'CSR', label: 'CSR' },
  { value: 'NRI', label: 'NRI' },
  { value: 'OTHER', label: 'Other' },
]
const BANK_TRANSFER_MODES = new Set(['NEFT', 'RTGS', 'ONLINE', 'DD'])
const PAYMENT_MODES = ['CASH', 'UPI', 'CHEQUE', 'NEFT', 'RTGS', 'DD', 'ONLINE']

const RECEIPT_TYPES = [
  {
    id: 'CASH',
    title: 'Cash / Bank donation',
    hint: 'Normal monetary receipt (Cash Book)',
  },
  {
    id: 'IN_KIND',
    title: 'In-kind (stock)',
    hint: 'Gold, clothes, materials — not in Cash Book',
  },
  {
    id: 'LIFETIME',
    title: 'Lifetime membership',
    hint: 'Enroll or record installment → donation receipt',
  },
]

const emptyLine = () => ({ stock_item_id: '', quantity: '', description: '', estimated_value: '' })

const cashSchema = z
  .object({
    donor_name: z.string().min(2, 'Name must be at least 2 characters'),
    donor_mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile'),
    donor_city: z.string().optional(),
    donor_email: z.string().email('Enter a valid email').optional().or(z.literal('')),
    donor_address: z.string().max(300, 'Address is too long').optional().or(z.literal('')),
    donor_state: z.string().max(100, 'State is too long').optional().or(z.literal('')),
    donor_pincode: z
      .string()
      .optional()
      .or(z.literal(''))
      .refine((v) => !v || /^\d{6}$/.test(v), 'Pincode must be 6 digits'),
    donor_type: z.enum(['INDIVIDUAL', 'BUSINESS', 'TRUST_NGO', 'CSR', 'NRI', 'OTHER']).default('INDIVIDUAL'),
    is_corpus: z.boolean().optional().default(false),
    amount: z.coerce
      .number()
      .positive('Amount must be greater than 0')
      .max(MAX_AMOUNT, `Amount cannot exceed ₹${MAX_AMOUNT.toLocaleString('en-IN')}`),
    payment_mode: z.enum(['CASH', 'UPI', 'CHEQUE', 'NEFT', 'RTGS', 'DD', 'ONLINE']),
    purpose: z.string().min(1, 'Purpose is required'),
    donation_date: z
      .string()
      .min(1, 'Date is required')
      .refine((d) => {
        const date = new Date(d)
        const end = new Date()
        end.setHours(23, 59, 59, 999)
        return !Number.isNaN(date.getTime()) && date.getTime() <= end.getTime()
      }, 'Donation date cannot be in the future'),
    upi_ref: z.string().optional(),
    cheque_number: z.string().optional(),
    bank_ref: z.string().optional(),
    pan_number: z
      .string()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? v.trim().toUpperCase() : v))
      .refine((v) => !v || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v), 'Enter a valid PAN (e.g. ABCDE1234F)'),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    for (const issue of validateDonationPaymentRefs(data.payment_mode, data)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue.message, path: [issue.field] })
    }
  })

export default function NewDonation() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [receiptType, setReceiptType] = useState('CASH')
  const [showOptionalDetails, setShowOptionalDetails] = useState(false)
  const [saving, setSaving] = useState(false)

  const createDonation = useCreateDonation()
  const createInKind = useCreateInKindReceipt()
  const createStockItem = useCreateStockItem()
  const enrollMember = useEnrollMember()
  const { data: planData } = useLifetimePlan()
  const { data: itemsData } = useStockItems(false)
  const stockItems = itemsData?.items || []
  const plan = planData?.plan

  // In-kind local state
  const [inkindForm, setInkindForm] = useState({
    donor_name: '',
    donor_mobile: '',
    donor_city: '',
    receipt_date: todayISO(),
    notes: '',
    estimated_value: '',
  })
  const [lines, setLines] = useState([emptyLine()])
  const [newItemName, setNewItemName] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('pcs')

  // Lifetime local state
  const [lifeForm, setLifeForm] = useState({
    name: '',
    mobile: '',
    city: '',
    start_date: todayISO(),
    amount: '',
    payment_date: todayISO(),
    payment_mode: 'CASH',
    upi_ref: '',
    cheque_number: '',
    bank_ref: '',
    notes: '',
    enroll_if_new: true,
  })

  const memberSearch = useCommitmentMembers(
    receiptType === 'LIFETIME' && lifeForm.mobile.length === 10
      ? { page: 1, limit: 10, search: lifeForm.mobile, status: 'ACTIVE' }
      : null
  )

  const matchedMember = useMemo(() => {
    const list = memberSearch.data?.members || []
    return list.find((m) => m.mobile === lifeForm.mobile) || null
  }, [memberSearch.data, lifeForm.mobile])

  async function postMembershipPayment(memberId, payload) {
    const { data } = await api.post(`/commitments/members/${memberId}/payments`, payload)
    qc.invalidateQueries({ queryKey: ['commitment-members'] })
    qc.invalidateQueries({ queryKey: ['commitment-summary'] })
    qc.invalidateQueries({ queryKey: ['donations'] })
    return data
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(cashSchema),
    defaultValues: {
      donor_name: '',
      donor_mobile: '',
      donor_city: '',
      donor_email: '',
      donor_address: '',
      donor_state: '',
      donor_pincode: '',
      donor_type: 'INDIVIDUAL',
      is_corpus: false,
      amount: '',
      payment_mode: 'CASH',
      purpose: 'General Donation',
      donation_date: todayISO(),
      upi_ref: '',
      cheque_number: '',
      bank_ref: '',
      pan_number: '',
      notes: '',
    },
  })

  const paymentMode = watch('payment_mode')
  const amount = Number(watch('amount') || 0)

  useEffect(() => {
    if (matchedMember && !lifeForm.amount && matchedMember.amount_pending != null) {
      setLifeForm((prev) => ({
        ...prev,
        name: prev.name || matchedMember.name,
        city: prev.city || matchedMember.city || '',
        amount: String(matchedMember.amount_pending || ''),
      }))
    }
  }, [matchedMember, lifeForm.amount])

  const updateLine = (idx, patch) => {
    setLines((prev) => prev.map((line, i) => (i === idx ? { ...line, ...patch } : line)))
  }

  const onSubmitCash = async (values) => {
    if (!confirmBackdatedEntry(values.donation_date, 'donation')) return
    try {
      const payload = { ...values }
      if (paymentMode !== 'UPI') delete payload.upi_ref
      if (paymentMode !== 'CHEQUE') delete payload.cheque_number
      if (!BANK_TRANSFER_MODES.has(paymentMode)) delete payload.bank_ref
      await createDonation.mutateAsync(payload)
      toast({ title: 'Donation recorded', description: 'Receipt will be generated shortly.' })
      navigate('/donations')
    } catch (err) {
      toast({ title: 'Failed to save', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const onSubmitInKind = async (e) => {
    e.preventDefault()
    if (!inkindForm.donor_name.trim() || inkindForm.donor_name.trim().length < 2) {
      toast({ title: 'Enter donor name', variant: 'destructive' })
      return
    }
    if (inkindForm.donor_mobile && !/^[6-9]\d{9}$/.test(inkindForm.donor_mobile)) {
      toast({ title: 'Enter a valid 10-digit mobile (or leave blank)', variant: 'destructive' })
      return
    }
    if (!confirmBackdatedEntry(inkindForm.receipt_date, 'in-kind receipt')) return
    const payloadLines = lines
      .filter((l) => l.stock_item_id && l.quantity)
      .map((l) => ({
        stock_item_id: l.stock_item_id,
        quantity: Number(l.quantity),
        description: l.description || '',
        estimated_value: l.estimated_value === '' ? null : Number(l.estimated_value),
      }))
    if (!payloadLines.length) {
      toast({ title: 'Add at least one stock item line', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const data = await createInKind.mutateAsync({
        ...inkindForm,
        estimated_value: inkindForm.estimated_value === '' ? null : Number(inkindForm.estimated_value),
        lines: payloadLines,
      })
      toast({ title: 'In-kind receipt saved', description: data.receipt?.receipt_number })
      navigate('/inkind')
    } catch (err) {
      toast({ title: 'Could not save in-kind receipt', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const onQuickAddItem = async () => {
    const name = newItemName.trim()
    if (!name) {
      toast({ title: 'Enter item name', variant: 'destructive' })
      return
    }
    try {
      const data = await createStockItem.mutateAsync({
        name,
        unit: newItemUnit.trim() || 'pcs',
      })
      toast({ title: 'Stock item added', description: data.item?.name })
      setNewItemName('')
      setNewItemUnit('pcs')
      if (data.item?.id) {
        setLines((prev) => {
          const next = [...prev]
          const emptyIdx = next.findIndex((l) => !l.stock_item_id)
          if (emptyIdx >= 0) next[emptyIdx] = { ...next[emptyIdx], stock_item_id: data.item.id }
          else next.push({ ...emptyLine(), stock_item_id: data.item.id })
          return next
        })
      }
    } catch (err) {
      toast({ title: 'Could not add item', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const onSubmitLifetime = async (e) => {
    e.preventDefault()
    if (!lifeForm.name.trim() || lifeForm.name.trim().length < 2) {
      toast({ title: 'Enter member name', variant: 'destructive' })
      return
    }
    if (!/^[6-9]\d{9}$/.test(lifeForm.mobile)) {
      toast({ title: 'Enter a valid 10-digit mobile', variant: 'destructive' })
      return
    }
    const payAmount = Number(lifeForm.amount)
    if (!payAmount || payAmount <= 0) {
      toast({ title: 'Enter installment amount', variant: 'destructive' })
      return
    }
    if (!confirmBackdatedEntry(lifeForm.payment_date, 'membership payment')) return

    setSaving(true)
    try {
      let member = matchedMember
      if (!member) {
        if (!lifeForm.enroll_if_new) {
          toast({
            title: 'Member not found',
            description: 'Enable “Enroll if new” or open Lifetime Membership to enroll first.',
            variant: 'destructive',
          })
          return
        }
        const enrolled = await enrollMember.mutateAsync({
          name: lifeForm.name.trim(),
          mobile: lifeForm.mobile,
          city: lifeForm.city || '',
          start_date: lifeForm.start_date || lifeForm.payment_date,
          notes: lifeForm.notes || '',
        })
        member = enrolled.member
        toast({ title: 'Lifetime member enrolled', description: member?.name })
      }

      const paymentPayload = {
        amount: payAmount,
        payment_date: lifeForm.payment_date,
        payment_mode: lifeForm.payment_mode,
        notes: lifeForm.notes || '',
      }
      if (lifeForm.payment_mode === 'UPI') paymentPayload.upi_ref = lifeForm.upi_ref
      if (lifeForm.payment_mode === 'CHEQUE') paymentPayload.cheque_number = lifeForm.cheque_number
      if (BANK_TRANSFER_MODES.has(lifeForm.payment_mode)) paymentPayload.bank_ref = lifeForm.bank_ref

      const data = await postMembershipPayment(member.id, paymentPayload)
      toast({
        title: 'Membership payment recorded',
        description: data?.donation?.receipt_number
          ? `Donation receipt ${data.donation.receipt_number}`
          : 'Balance updated',
      })
      navigate('/donations')
    } catch (err) {
      toast({ title: 'Failed', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="New Receipt"
        mobileTitle="New Receipt"
        description="Cash donation, in-kind stock, or lifetime membership installment — pick type below."
      />

      <Card className="mb-4 w-full max-w-2xl">
        <CardContent className="pt-5">
          <RequiredLabel>Receipt / donation type</RequiredLabel>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {RECEIPT_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setReceiptType(t.id)}
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-left transition-colors',
                  receiptType === t.id
                    ? 'border-maroon bg-maroon/5 ring-1 ring-maroon'
                    : 'border-border hover:bg-muted/40'
                )}
              >
                <p className="text-sm font-semibold">{t.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{t.hint}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {receiptType === 'CASH' ? (
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmitCash)} className="grid gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <RequiredLabel>Donor name</RequiredLabel>
                <Input {...register('donor_name')} />
                {errors.donor_name && <p className="text-sm text-destructive">{errors.donor_name.message}</p>}
              </div>
              <div>
                <RequiredLabel>Mobile</RequiredLabel>
                <Input {...register('donor_mobile')} maxLength={10} />
                {errors.donor_mobile && <p className="text-sm text-destructive">{errors.donor_mobile.message}</p>}
              </div>
              <div>
                <RequiredLabel optional>City</RequiredLabel>
                <Input {...register('donor_city')} />
              </div>
              <div>
                <RequiredLabel>Amount (₹)</RequiredLabel>
                <Input type="number" min={0.01} max={MAX_AMOUNT} step="0.01" {...register('amount')} />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                {amount > 10_000 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Adding PAN and address helps with donor reporting and audit records.
                  </p>
                ) : null}
              </div>
              <div>
                <RequiredLabel>Donation date</RequiredLabel>
                <Input type="date" max={todayISO()} {...register('donation_date')} />
                {errors.donation_date && <p className="text-sm text-destructive">{errors.donation_date.message}</p>}
              </div>
              <div>
                <RequiredLabel>Payment mode</RequiredLabel>
                <Select value={paymentMode} onValueChange={(v) => setValue('payment_mode', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((m) => (
                      <SelectItem key={m} value={m}>{formatPaymentMode(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {paymentMode === 'UPI' ? (
                <div className="sm:col-span-2">
                  <RequiredLabel>UPI Reference Number</RequiredLabel>
                  <Input {...register('upi_ref')} />
                  {errors.upi_ref && <p className="text-sm text-destructive">{errors.upi_ref.message}</p>}
                </div>
              ) : null}
              {paymentMode === 'CHEQUE' ? (
                <div className="sm:col-span-2">
                  <RequiredLabel>Cheque Number</RequiredLabel>
                  <Input {...register('cheque_number')} />
                  {errors.cheque_number && <p className="text-sm text-destructive">{errors.cheque_number.message}</p>}
                </div>
              ) : null}
              {BANK_TRANSFER_MODES.has(paymentMode) ? (
                <div className="sm:col-span-2">
                  <RequiredLabel>Bank Transaction ID</RequiredLabel>
                  <Input {...register('bank_ref')} />
                  {errors.bank_ref && <p className="text-sm text-destructive">{errors.bank_ref.message}</p>}
                </div>
              ) : null}
              <div>
                <RequiredLabel>Purpose</RequiredLabel>
                <Input {...register('purpose')} />
                {errors.purpose && <p className="text-sm text-destructive">{errors.purpose.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <RequiredLabel optional>Notes</RequiredLabel>
                <Textarea {...register('notes')} />
              </div>
              <div className="sm:col-span-2">
                <div className="overflow-hidden rounded-xl border border-border/70 bg-saffron/5">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-saffron/10 sm:gap-3 sm:px-4 sm:py-3"
                    onClick={() => setShowOptionalDetails((prev) => !prev)}
                    aria-expanded={showOptionalDetails}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight text-foreground">Additional Donor Details (Optional)</p>
                      <p className="line-clamp-1 text-[11px] leading-tight text-muted-foreground sm:line-clamp-none sm:text-xs">
                        Useful for PAN, address, donor certificates and audit records.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                      <span className="hidden sm:inline">{showOptionalDetails ? 'Hide Details' : 'Expand Details'}</span>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform duration-200',
                          showOptionalDetails && 'rotate-180'
                        )}
                      />
                    </div>
                  </button>

                  {showOptionalDetails ? (
                    <div className="border-t border-border/60 bg-background/70 px-4 py-3">
                      <div className="grid gap-3.5 sm:grid-cols-2">
                        <div>
                          <Label>PAN Number</Label>
                          <Input {...register('pan_number')} style={{ textTransform: 'uppercase' }} />
                          <p className="mt-1 text-xs text-muted-foreground">For 80G and donor reporting purposes.</p>
                          {errors.pan_number && <p className="text-sm text-destructive">{errors.pan_number.message}</p>}
                        </div>
                        <div>
                          <Label>Email Address</Label>
                          <Input type="email" {...register('donor_email')} />
                          {errors.donor_email && <p className="text-sm text-destructive">{errors.donor_email.message}</p>}
                        </div>
                        <div className="sm:col-span-2">
                          <Label>Address Line</Label>
                          <Input {...register('donor_address')} />
                        </div>
                        <div>
                          <Label>State</Label>
                          <Input {...register('donor_state')} />
                        </div>
                        <div>
                          <Label>Pincode</Label>
                          <Input {...register('donor_pincode')} maxLength={6} inputMode="numeric" />
                        </div>
                        <div>
                          <Label>Donor Type</Label>
                          <Select value={watch('donor_type')} onValueChange={(v) => setValue('donor_type', v, { shouldValidate: true })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {DONOR_TYPE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-start gap-2 rounded-md border border-border/70 bg-muted/20 p-3">
                          <input type="checkbox" id="is_corpus" className="mt-1 h-4 w-4" {...register('is_corpus')} />
                          <div>
                            <Label htmlFor="is_corpus" className="cursor-pointer">Corpus Donation</Label>
                            <p className="text-xs text-muted-foreground">Applicable for permanent trust corpus contributions.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Donation'}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/donations')}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {receiptType === 'IN_KIND' ? (
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <form onSubmit={onSubmitInKind} className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Goods receipt updates stock only. It does not post to Cash Book.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <RequiredLabel>Donor name</RequiredLabel>
                  <Input
                    value={inkindForm.donor_name}
                    onChange={(e) => setInkindForm({ ...inkindForm, donor_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Mobile</Label>
                  <Input
                    value={inkindForm.donor_mobile}
                    onChange={(e) => setInkindForm({ ...inkindForm, donor_mobile: e.target.value })}
                    placeholder="Optional 10-digit"
                    maxLength={10}
                  />
                </div>
                <div>
                  <Label>City</Label>
                  <Input
                    value={inkindForm.donor_city}
                    onChange={(e) => setInkindForm({ ...inkindForm, donor_city: e.target.value })}
                  />
                </div>
                <div>
                  <RequiredLabel>Receipt date</RequiredLabel>
                  <Input
                    type="date"
                    max={todayISO()}
                    value={inkindForm.receipt_date}
                    onChange={(e) => setInkindForm({ ...inkindForm, receipt_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Estimated total value (₹, optional)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={inkindForm.estimated_value}
                    onChange={(e) => setInkindForm({ ...inkindForm, estimated_value: e.target.value })}
                  />
                </div>
              </div>

              <div className="rounded-md border border-dashed p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Quick-add stock item (if missing)</p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="max-w-[180px]"
                    placeholder="Item name"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                  />
                  <Input
                    className="w-24"
                    placeholder="Unit"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={onQuickAddItem} disabled={createStockItem.isPending}>
                    Add item
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Items received</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, emptyLine()])}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add line
                  </Button>
                </div>
                {lines.map((line, idx) => (
                  <div key={idx} className="grid gap-2 rounded-md border p-3 sm:grid-cols-12">
                    <div className="sm:col-span-4">
                      <Label>Item</Label>
                      <Select value={line.stock_item_id} onValueChange={(v) => updateLine(idx, { stock_item_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {stockItems.map((i) => (
                            <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        min="0.001"
                        step="any"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                        required
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Label>Description</Label>
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(idx, { description: e.target.value })}
                        placeholder="e.g. Gold chain"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Est. ₹</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={line.estimated_value}
                        onChange={(e) => updateLine(idx, { estimated_value: e.target.value })}
                      />
                    </div>
                    <div className="flex items-end sm:col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={lines.length === 1}
                        onClick={() => setLines((p) => p.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!stockItems.length ? (
                  <p className="text-sm text-muted-foreground">No stock items yet — use Quick-add above or In-Kind Stock.</p>
                ) : null}
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={inkindForm.notes}
                  onChange={(e) => setInkindForm({ ...inkindForm, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving || createInKind.isPending}>
                  {saving ? 'Saving...' : 'Save in-kind receipt'}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/donations')}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {receiptType === 'LIFETIME' ? (
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <form onSubmit={onSubmitLifetime} className="grid gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-sm">
                <p className="font-medium">{plan?.title || 'Lifetime Membership'}</p>
                <p className="text-xs text-muted-foreground">
                  Commitment {formatCurrency(plan?.total_amount || 0)} over {plan?.tenure_months || '—'} months.
                  Each payment creates a normal donation receipt.
                </p>
                {matchedMember ? (
                  <p className="mt-1 text-xs text-emerald-700">
                    Existing member found — pending {formatCurrency(matchedMember.amount_pending || 0)} ({matchedMember.percent_paid}% paid)
                  </p>
                ) : lifeForm.mobile.length === 10 ? (
                  <p className="mt-1 text-xs text-amber-700">No active member on this mobile — will enroll as new if checked below.</p>
                ) : null}
              </div>

              <div className="sm:col-span-2">
                <RequiredLabel>Member name</RequiredLabel>
                <Input
                  value={lifeForm.name}
                  onChange={(e) => setLifeForm({ ...lifeForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <RequiredLabel>Mobile</RequiredLabel>
                <Input
                  value={lifeForm.mobile}
                  onChange={(e) => setLifeForm({ ...lifeForm, mobile: e.target.value })}
                  maxLength={10}
                  required
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={lifeForm.city}
                  onChange={(e) => setLifeForm({ ...lifeForm, city: e.target.value })}
                />
              </div>
              {!matchedMember ? (
                <div>
                  <Label>Membership start date</Label>
                  <Input
                    type="date"
                    max={todayISO()}
                    value={lifeForm.start_date}
                    onChange={(e) => setLifeForm({ ...lifeForm, start_date: e.target.value })}
                  />
                </div>
              ) : null}
              <div>
                <RequiredLabel>Installment amount (₹)</RequiredLabel>
                <Input
                  type="number"
                  min={1}
                  step="any"
                  value={lifeForm.amount}
                  onChange={(e) => setLifeForm({ ...lifeForm, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <RequiredLabel>Payment date</RequiredLabel>
                <Input
                  type="date"
                  max={todayISO()}
                  value={lifeForm.payment_date}
                  onChange={(e) => setLifeForm({ ...lifeForm, payment_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <RequiredLabel>Payment mode</RequiredLabel>
                <Select
                  value={lifeForm.payment_mode}
                  onValueChange={(v) => setLifeForm({ ...lifeForm, payment_mode: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((m) => (
                      <SelectItem key={m} value={m}>{formatPaymentMode(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {lifeForm.payment_mode === 'UPI' ? (
                <div className="sm:col-span-2">
                  <Label>UPI ref</Label>
                  <Input
                    value={lifeForm.upi_ref}
                    onChange={(e) => setLifeForm({ ...lifeForm, upi_ref: e.target.value })}
                  />
                </div>
              ) : null}
              {lifeForm.payment_mode === 'CHEQUE' ? (
                <div className="sm:col-span-2">
                  <Label>Cheque no.</Label>
                  <Input
                    value={lifeForm.cheque_number}
                    onChange={(e) => setLifeForm({ ...lifeForm, cheque_number: e.target.value })}
                  />
                </div>
              ) : null}
              {BANK_TRANSFER_MODES.has(lifeForm.payment_mode) ? (
                <div className="sm:col-span-2">
                  <Label>Bank ref</Label>
                  <Input
                    value={lifeForm.bank_ref}
                    onChange={(e) => setLifeForm({ ...lifeForm, bank_ref: e.target.value })}
                  />
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={lifeForm.notes}
                  onChange={(e) => setLifeForm({ ...lifeForm, notes: e.target.value })}
                />
              </div>
              {!matchedMember ? (
                <div className="sm:col-span-2 flex items-start gap-2 rounded-md border p-3">
                  <input
                    type="checkbox"
                    id="enroll_if_new"
                    className="mt-1 h-4 w-4"
                    checked={lifeForm.enroll_if_new}
                    onChange={(e) => setLifeForm({ ...lifeForm, enroll_if_new: e.target.checked })}
                  />
                  <div>
                    <Label htmlFor="enroll_if_new" className="cursor-pointer">Enroll as new lifetime member if not found</Label>
                    <p className="text-xs text-muted-foreground">Then record this amount as the first installment.</p>
                  </div>
                </div>
              ) : null}
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" disabled={saving || enrollMember.isPending}>
                  {saving ? 'Saving...' : matchedMember ? 'Record membership payment' : 'Enroll & record payment'}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/donations')}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
