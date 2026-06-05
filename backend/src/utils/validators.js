const { z } = require('zod')

/** Matches Prisma Decimal(10, 2) — max ₹99,999,999.99 */
const MAX_AMOUNT = 99_999_999.99

function isDateNotInFuture(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  return d.getTime() <= endOfToday.getTime()
}

const dateNotFuture = (label = 'Date') =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be in YYYY-MM-DD format`)
    .refine(isDateNotInFuture, `${label} cannot be in the future`)

const amountField = z
  .number({ invalid_type_error: 'Amount must be a number' })
  .positive('Amount must be greater than 0')
  .max(MAX_AMOUNT, `Amount cannot exceed ₹${MAX_AMOUNT.toLocaleString('en-IN')}`)

const DONOR_TYPES = ['INDIVIDUAL', 'BUSINESS', 'TRUST_NGO', 'CSR', 'NRI', 'OTHER']

const optionalText = (max, label) => z.string().max(max, `${label} is too long`).optional().or(z.literal(''))

const donationSchema = z.object({
  donor_name: z.string().min(2, 'Donor name must be at least 2 characters').max(200, 'Donor name is too long'),
  donor_mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  donor_city: z.string().max(100).optional(),
  donor_email: z.string().email().optional().or(z.literal('')),
  donor_address: optionalText(300, 'Address line'),
  donor_state: optionalText(100, 'State'),
  donor_pincode: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || /^\d{6}$/.test(v), 'Pincode must be 6 digits'),
  donor_type: z.enum(DONOR_TYPES).optional().default('INDIVIDUAL'),
  is_corpus: z.boolean().optional().default(false),
  amount: amountField,
  payment_mode: z.enum(['CASH', 'UPI', 'CHEQUE', 'NEFT', 'RTGS', 'DD', 'ONLINE'], { errorMap: () => ({ message: 'Select a valid payment mode' }) }),
  upi_ref: z.string().max(100).optional(),
  cheque_number: z.string().max(50).optional(),
  bank_ref: z.string().max(100).optional().or(z.literal('')),
  purpose: z.string().min(1).max(500).default('General Donation'),
  donation_date: dateNotFuture('Donation date'),
  notes: z.string().max(2000).optional(),
  pan_number: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim().toUpperCase() : v))
    .refine((v) => !v || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v), 'Enter a valid PAN (e.g. ABCDE1234F)'),
})

const trusteeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200, 'Name is too long'),
  name_hindi: z.string().max(200).optional().or(z.literal('')),
  mobile: z.string().regex(/^[6-9]\d{9}$/).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  role: z.string().min(2, 'Role is required').max(100, 'Role is too long').default('Trustee'),
  joining_date: dateNotFuture('Joining date').optional().or(z.literal('')),
  pan_number: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim().toUpperCase() : v))
    .refine((v) => !v || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v), 'Enter a valid PAN (e.g. ABCDE1234F)'),
  address: z.string().max(300, 'Address is too long').optional().or(z.literal('')),
  address_line1: z.string().max(150, 'Address Line 1 is too long').optional().or(z.literal('')),
  address_line2: z.string().max(150, 'Address Line 2 is too long').optional().or(z.literal('')),
  city: z.string().max(100, 'City is too long').optional().or(z.literal('')),
  state: z.string().max(100, 'State is too long').optional().or(z.literal('')),
  pincode: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || /^\d{6}$/.test(v), 'Pincode must be 6 digits'),
  notes: z.string().max(1000, 'Notes are too long').optional().or(z.literal('')),
  authorized_signatory: z.boolean().optional().default(false),
  bank_signatory: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
  display_order: z.number().int().default(0),
})

const contributionSchema = z.object({
  amount: amountField,
  contribution_date: dateNotFuture('Contribution date'),
  payment_mode: z.enum(['CASH', 'UPI', 'CHEQUE', 'NEFT', 'RTGS', 'DD', 'ONLINE']).optional(),
  remarks: z.string().max(500).optional(),
})

const expenseSchema = z.object({
  expense_date: dateNotFuture('Expense date'),
  category: z.enum(
    [
      'LABOUR_CONSTRUCTION',
      'RELIGIOUS_ACTIVITIES',
      'TEMPLE_MAINTENANCE',
      'UTILITIES',
      'PRASAD_FOOD_DISTRIBUTION',
      'FESTIVAL_EXPENSES',
      'ADMINISTRATIVE_EXPENSES',
      'SALARY_WAGES',
      'LEGAL_PROFESSIONAL',
      'TRAVEL',
      'CHARITY_RELIEF',
      'BANK_CHARGES',
      'OTHER',
      // legacy values kept for backward compatibility
      'CONSTRUCTION',
      'MATERIALS',
      'LABOUR',
      'PUJA',
      'ADMIN',
      'FOOD',
    ],
    { errorMap: () => ({ message: 'Select a valid category' }) }
  ),
  expense_nature: z
    .enum(['OPERATIONAL', 'RELIGIOUS', 'CONSTRUCTION', 'ADMINISTRATIVE', 'WELFARE', 'OTHER'])
    .optional()
    .default('OPERATIONAL'),
  amount: amountField,
  description: z.string().min(3, 'Description must be at least 3 characters').max(500, 'Description is too long'),
  paid_to: z.string().max(200).optional(),
  vendor_mobile: z.string().regex(/^[6-9]\d{9}$/).optional().or(z.literal('')),
  payment_mode: z.enum(['CASH', 'UPI', 'CHEQUE', 'NEFT', 'RTGS', 'DD', 'ONLINE']).optional().default('CASH'),
  upi_ref: z.string().max(100).optional().or(z.literal('')),
  cheque_number: z.string().max(50).optional().or(z.literal('')),
  transaction_id: z.string().max(100).optional().or(z.literal('')),
  reference: z.string().max(100).optional(),
  payment_channel: z.enum(['CASH', 'BANK']).optional(),
  notes: z.string().max(1000).optional().or(z.literal('')),
  vendor_id: z.string().optional().or(z.literal('')),
})

const vendorSchema = z.object({
  name: z.string().min(2, 'Vendor name must be at least 2 characters').max(200, 'Vendor name is too long'),
  mobile: z.string().regex(/^[6-9]\d{9}$/).optional().or(z.literal('')),
  category: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  is_active: z.boolean().optional().default(true),
})

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/^(?=.*[A-Z])(?=.*\d).+$/, 'Password must include one uppercase letter and one number')

const trustSlugField = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may only use lowercase letters, numbers, and hyphens')

const platformTrustSchema = z.object({
  slug: trustSlugField,
  name: z.string().min(2, 'Trust name is required').max(200),
  name_hindi: z.string().min(2, 'Hindi name is required').max(200),
  address: z.string().min(5, 'Address is required').max(500),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit phone number'),
  email: z.string().email().optional().or(z.literal('')),
  receipt_prefix: z
    .string()
    .min(2, 'Receipt prefix must be at least 2 characters')
    .max(10)
    .regex(/^[A-Z0-9]+$/, 'Receipt prefix must be uppercase letters/numbers only'),
  current_fy: z.string().regex(/^\d{4}-\d{2}$/, 'Financial year must be like 2025-26').optional(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  admin_name: z.string().min(2, 'Admin name is required').max(200),
  admin_username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-z0-9@._-]+$/, 'Username may use lowercase letters, numbers, @, dot, underscore, hyphen'),
  admin_password: passwordField,
})

const platformUserSchema = z.object({
  name: z.string().min(2, 'Name is required').max(200),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-z0-9@._-]+$/, 'Username may use lowercase letters, numbers, @, dot, underscore, hyphen'),
  password: passwordField,
  role: z.enum(['ADMIN', 'OPERATOR']).default('OPERATOR'),
})

const platformUserPatchSchema = z.object({
  is_active: z.boolean().optional(),
  role: z.enum(['ADMIN', 'OPERATOR']).optional(),
})

const trustUserSchema = platformUserSchema

const trustUserPatchSchema = platformUserPatchSchema

const trustUserPasswordSchema = z.object({
  new_password: passwordField,
})

const trustSlugUpdateSchema = z.object({
  slug: trustSlugField,
  custom_domain: z
    .string()
    .max(253)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i, 'Enter a valid domain')
    .optional()
    .or(z.literal('')),
})

function validationError(message) {
  const err = new Error(message)
  err.name = 'ZodError'
  err.errors = [{ message }]
  return err
}

/** Parse ?date_from= / ?date_to= query params (YYYY-MM-DD). */
function parseQueryDateParam(value, label = 'Date') {
  if (value == null || value === '') return null
  const str = String(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    throw validationError(`${label} must be in YYYY-MM-DD format`)
  }
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) {
    throw validationError(`Invalid ${label}`)
  }
  return d
}

function validate(schema, data) {
  const result = schema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.errors[0]
    const err = new Error(firstError.message)
    err.name = 'ZodError'
    err.errors = result.error.errors
    throw err
  }
  return result.data
}

/** Merge existing donation with PATCH fields and validate full record. */
function validateDonationUpdate(existing, patch) {
  const donationDate =
    patch.donation_date != null
      ? typeof patch.donation_date === 'string'
        ? patch.donation_date
        : new Date(patch.donation_date).toISOString().slice(0, 10)
      : new Date(existing.donation_date).toISOString().slice(0, 10)

  return validate(donationSchema, {
    donor_name: patch.donor_name ?? existing.donor_name,
    donor_mobile: patch.donor_mobile ?? existing.donor_mobile,
    donor_city: patch.donor_city ?? existing.donor_city ?? '',
    donor_email: patch.donor_email ?? existing.donor_email ?? '',
    donor_address: patch.donor_address ?? existing.donor_address ?? '',
    donor_state: patch.donor_state ?? existing.donor_state ?? '',
    donor_pincode: patch.donor_pincode ?? existing.donor_pincode ?? '',
    donor_type: patch.donor_type ?? existing.donor_type ?? 'INDIVIDUAL',
    is_corpus: patch.is_corpus ?? existing.is_corpus ?? false,
    amount: patch.amount !== undefined ? parseFloat(patch.amount) : Number(existing.amount),
    payment_mode: patch.payment_mode ?? existing.payment_mode,
    upi_ref: patch.upi_ref ?? existing.upi_ref ?? '',
    cheque_number: patch.cheque_number ?? existing.cheque_number ?? '',
    bank_ref: patch.bank_ref ?? existing.bank_ref ?? '',
    purpose: patch.purpose ?? existing.purpose,
    donation_date: donationDate,
    notes: patch.notes ?? existing.notes ?? '',
    pan_number: patch.pan_number ?? existing.pan_number ?? '',
  })
}

module.exports = {
  donationSchema,
  trusteeSchema,
  contributionSchema,
  expenseSchema,
  vendorSchema,
  loginSchema,
  platformTrustSchema,
  platformUserSchema,
  platformUserPatchSchema,
  trustUserSchema,
  trustUserPatchSchema,
  trustUserPasswordSchema,
  trustSlugUpdateSchema,
  trustSlugField,
  validate,
  validateDonationUpdate,
  parseQueryDateParam,
  MAX_AMOUNT,
}

