export const PAYEE_AMOUNT_THRESHOLD = 5000
export const BACKDATE_WARNING_DAYS = 7
export const HIGH_VALUE_ATTACHMENT_THRESHOLD = 5000

export const BANK_PAYMENT_MODES = new Set(['NEFT', 'RTGS', 'ONLINE', 'DD'])
export const ALL_NON_CASH_MODES = new Set(['UPI', 'CHEQUE', 'NEFT', 'RTGS', 'ONLINE', 'DD'])

export const EXPENSE_NATURE_BY_CATEGORY = {
  LABOUR_CONSTRUCTION: 'CONSTRUCTION',
  CONSTRUCTION: 'CONSTRUCTION',
  MATERIALS: 'CONSTRUCTION',
  RELIGIOUS_ACTIVITIES: 'RELIGIOUS',
  PUJA: 'RELIGIOUS',
  TEMPLE_MAINTENANCE: 'OPERATIONAL',
  UTILITIES: 'OPERATIONAL',
  PRASAD_FOOD_DISTRIBUTION: 'WELFARE',
  FOOD: 'WELFARE',
  FESTIVAL_EXPENSES: 'RELIGIOUS',
  ADMINISTRATIVE_EXPENSES: 'ADMINISTRATIVE',
  ADMIN: 'ADMINISTRATIVE',
  SALARY_WAGES: 'ADMINISTRATIVE',
  LEGAL_PROFESSIONAL: 'ADMINISTRATIVE',
  TRAVEL: 'OPERATIONAL',
  CHARITY_RELIEF: 'WELFARE',
  BANK_CHARGES: 'ADMINISTRATIVE',
  OTHER: 'OTHER',
  LABOUR: 'CONSTRUCTION',
}

export function natureForExpenseCategory(category) {
  return EXPENSE_NATURE_BY_CATEGORY[category] || 'OPERATIONAL'
}

export function isBackdated(dateStr, days = BACKDATE_WARNING_DAYS) {
  if (!dateStr) return false
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return false
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - days)
  return date.getTime() < cutoff.getTime()
}

export function parseAmount(value) {
  const num = parseFloat(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(num) ? num : 0
}

/** Client-side expense voucher checks (mirrors backend rules). */
export function validateExpenseForm(form, paymentMode) {
  const issues = []
  const amount = parseAmount(form.amount)

  if (!amount || amount <= 0) {
    issues.push({ field: 'amount', message: 'Enter a valid amount greater than 0' })
  }

  const needsPayee =
    amount >= PAYEE_AMOUNT_THRESHOLD || (paymentMode && paymentMode !== 'CASH')

  if (needsPayee && !String(form.paid_to || '').trim()) {
    issues.push({
      field: 'paid_to',
      message:
        amount >= PAYEE_AMOUNT_THRESHOLD
          ? `Payee name is required for amounts ₹${PAYEE_AMOUNT_THRESHOLD.toLocaleString('en-IN')} or above`
          : 'Payee name is required for non-cash payments',
    })
  }

  if (paymentMode === 'UPI' && !String(form.upi_ref || '').trim()) {
    issues.push({ field: 'upi_ref', message: 'UPI reference number is required' })
  }
  if (paymentMode === 'CHEQUE' && !String(form.cheque_number || '').trim()) {
    issues.push({ field: 'cheque_number', message: 'Cheque number is required' })
  }
  if (BANK_PAYMENT_MODES.has(paymentMode) && !String(form.transaction_id || '').trim()) {
    issues.push({ field: 'transaction_id', message: 'Transaction ID is required for bank transfers' })
  }

  if (form.vendor_mobile && !/^[6-9]\d{9}$/.test(form.vendor_mobile)) {
    issues.push({ field: 'vendor_mobile', message: 'Enter a valid 10-digit mobile number' })
  }

  return issues
}

export function validateDonationPaymentRefs(paymentMode, values) {
  const issues = []
  if (paymentMode === 'UPI' && !String(values.upi_ref || '').trim()) {
    issues.push({ field: 'upi_ref', message: 'UPI reference is required' })
  }
  if (paymentMode === 'CHEQUE' && !String(values.cheque_number || '').trim()) {
    issues.push({ field: 'cheque_number', message: 'Cheque number is required' })
  }
  if (BANK_PAYMENT_MODES.has(paymentMode) && !String(values.bank_ref || '').trim()) {
    issues.push({ field: 'bank_ref', message: 'Bank / transaction reference is required' })
  }
  return issues
}

export function confirmBackdatedEntry(dateStr, label = 'voucher') {
  if (!isBackdated(dateStr)) return true
  return window.confirm(
    `This ${label} date is more than ${BACKDATE_WARNING_DAYS} days in the past. Record anyway?`
  )
}

export function confirmDuplicateVoucher(message) {
  return window.confirm(message || 'A similar voucher was recorded recently. Continue anyway?')
}

export function formatAttachmentHint(file) {
  if (!file) return null
  const kb = Math.max(1, Math.round(file.size / 1024))
  return `${file.name} (${kb} KB)`
}

export function normalizeVendorName(name) {
  return String(name ?? '').trim().toLowerCase()
}

export function normalizeVendorMobile(mobile) {
  return String(mobile ?? '').trim()
}

/** Exact match on trimmed name (case-insensitive) and mobile. Both must be non-empty. */
export function findExactVendorMatch(vendors, name, mobile) {
  const normalizedName = normalizeVendorName(name)
  const normalizedMobile = normalizeVendorMobile(mobile)
  if (!normalizedName || !normalizedMobile) return null
  return (
    (vendors || []).find(
      (v) =>
        normalizeVendorName(v.name) === normalizedName &&
        normalizeVendorMobile(v.mobile) === normalizedMobile
    ) || null
  )
}

export function isVendorLinked(vendor, vendorId) {
  return Boolean(vendorId && vendor?.id === vendorId)
}
