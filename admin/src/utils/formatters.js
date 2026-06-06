const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const currencyFormatterDecimals = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
})

export function formatCurrency(value, withDecimals = false) {
  const num = Number(value) || 0
  return withDecimals ? currencyFormatterDecimals.format(num) : currencyFormatter.format(num)
}

export function formatDate(value) {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const PAYMENT_LABELS = {
  CASH: 'Cash',
  UPI: 'UPI',
  CHEQUE: 'Cheque',
  NEFT: 'NEFT',
  RTGS: 'RTGS',
  DD: 'Demand Draft',
  ONLINE: 'Online',
}

export function formatPaymentMode(mode) {
  return PAYMENT_LABELS[mode] || mode || '—'
}

export const EXPENSE_CATEGORIES = [
  { value: 'LABOUR_CONSTRUCTION', label: 'Labour & Construction' },
  { value: 'RELIGIOUS_ACTIVITIES', label: 'Religious Activities' },
  { value: 'TEMPLE_MAINTENANCE', label: 'Temple Maintenance' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'PRASAD_FOOD_DISTRIBUTION', label: 'Prasad / Food Distribution' },
  { value: 'FESTIVAL_EXPENSES', label: 'Festival Expenses' },
  { value: 'ADMINISTRATIVE_EXPENSES', label: 'Administrative Expenses' },
  { value: 'SALARY_WAGES', label: 'Salary / Wages' },
  { value: 'LEGAL_PROFESSIONAL', label: 'Legal & Professional' },
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'CHARITY_RELIEF', label: 'Charity / Relief' },
  { value: 'BANK_CHARGES', label: 'Bank Charges' },
  { value: 'OTHER', label: 'Other' },
]

export function formatExpenseCategory(category) {
  return EXPENSE_CATEGORIES.find((c) => c.value === category)?.label || category
}

/** Display text for expense particulars — falls back when description is empty. */
export function formatExpenseParticulars(expense) {
  const desc = String(expense?.description ?? '').trim()
  if (desc) return desc
  const cat = formatExpenseCategory(expense?.category)
  const payee = String(expense?.paid_to ?? '').trim()
  if (cat && payee) return `${cat} — ${payee}`
  return payee || cat || '—'
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
