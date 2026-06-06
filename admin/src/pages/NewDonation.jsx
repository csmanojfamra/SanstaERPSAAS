import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateDonation } from '@/hooks/useDonations'
import { formatPaymentMode, todayISO } from '@/utils/formatters'
import { getApiErrorMessage } from '@/lib/api'
import { validateDonationPaymentRefs, confirmBackdatedEntry } from '@/lib/formHelpers'
import RequiredLabel from '@/components/common/RequiredLabel'
import { toast } from '@/hooks/use-toast'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

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

const schema = z.object({
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
}).superRefine((data, ctx) => {
  for (const issue of validateDonationPaymentRefs(data.payment_mode, data)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue.message, path: [issue.field] })
  }
})

const PAYMENT_MODES = ['CASH', 'UPI', 'CHEQUE', 'NEFT', 'RTGS', 'DD', 'ONLINE']

export default function NewDonation() {
  const navigate = useNavigate()
  const createMutation = useCreateDonation()
  const [showOptionalDetails, setShowOptionalDetails] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
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

  const onSubmit = async (values) => {
    if (!confirmBackdatedEntry(values.donation_date, 'donation')) return
    try {
      const payload = { ...values }
      if (paymentMode !== 'UPI') delete payload.upi_ref
      if (paymentMode !== 'CHEQUE') delete payload.cheque_number
      if (!BANK_TRANSFER_MODES.has(paymentMode)) delete payload.bank_ref
      await createMutation.mutateAsync(payload)
      toast({ title: 'Donation recorded', description: 'Receipt will be generated shortly.' })
      navigate('/donations')
    } catch (err) {
      toast({ title: 'Failed to save', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  return (
    <>
      <PageHeader title="New Donation" mobileTitle="New Donation" description="Record a new donation receipt" />

      <Card className="w-full max-w-2xl">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3.5 sm:grid-cols-2">
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
              <Input
                type="number"
                min={0.01}
                max={MAX_AMOUNT}
                step="0.01"
                {...register('amount')}
              />
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
                        {errors.donor_address && <p className="text-sm text-destructive">{errors.donor_address.message}</p>}
                      </div>

                      <div>
                        <Label>State</Label>
                        <Input {...register('donor_state')} />
                        {errors.donor_state && <p className="text-sm text-destructive">{errors.donor_state.message}</p>}
                      </div>
                      <div>
                        <Label>Pincode</Label>
                        <Input {...register('donor_pincode')} maxLength={6} inputMode="numeric" />
                        {errors.donor_pincode && <p className="text-sm text-destructive">{errors.donor_pincode.message}</p>}
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
                          <p className="text-xs text-muted-foreground">
                            Applicable for permanent trust corpus contributions.
                          </p>
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
    </>
  )
}
