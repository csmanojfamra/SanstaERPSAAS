const router = require('express').Router()
const prisma = require('../../lib/prisma')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { expenseSchema, validate, parseQueryDateParam } = require('../../utils/validators')
const logger = require('../../utils/logger')
const { createAuditLog } = require('../../services/audit.service')
const { createNotification } = require('../../services/notification.service')
const { getAuditContext } = require('../../utils/auditContext')
const { generateExpenseVoucherPdf } = require('../../services/expenseVoucher.service')

const CATEGORY_LABELS = {
  LABOUR_CONSTRUCTION: 'Labour & Construction',
  RELIGIOUS_ACTIVITIES: 'Religious Activities',
  TEMPLE_MAINTENANCE: 'Temple Maintenance',
  UTILITIES: 'Utilities',
  PRASAD_FOOD_DISTRIBUTION: 'Prasad / Food Distribution',
  FESTIVAL_EXPENSES: 'Festival Expenses',
  ADMINISTRATIVE_EXPENSES: 'Administrative Expenses',
  SALARY_WAGES: 'Salary / Wages',
  LEGAL_PROFESSIONAL: 'Legal & Professional',
  TRAVEL: 'Travel',
  CHARITY_RELIEF: 'Charity / Relief',
  BANK_CHARGES: 'Bank Charges',
  OTHER: 'Other',
  // legacy labels
  CONSTRUCTION: 'Construction',
  MATERIALS: 'Materials',
  LABOUR: 'Labour',
  PUJA: 'Puja',
  ADMIN: 'Administration',
  FOOD: 'Food',
}

const HIGH_VALUE_THRESHOLD = 50000

const uploadDir = path.join(__dirname, '../../../uploads/expense-bills')
fs.mkdirSync(uploadDir, { recursive: true })
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ts = Date.now()
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${ts}_${safe}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    cb(null, allowed.includes(file.mimetype))
  },
})

function mapPaymentChannel(mode, channel) {
  if (channel) return channel
  if (mode === 'CASH') return 'CASH'
  return 'BANK'
}

async function resolveVendorId(trustId, data) {
  if (data.vendor_id) {
    const selected = await prisma.vendor.findFirst({
      where: { id: data.vendor_id, trust_id: trustId },
      select: { id: true },
    })
    return selected?.id || null
  }
  if (!data.paid_to) return null
  const vendor = await prisma.vendor.findFirst({
    where: {
      trust_id: trustId,
      is_active: true,
      name: { equals: data.paid_to.trim(), mode: 'insensitive' },
      ...(data.vendor_mobile ? { mobile: data.vendor_mobile } : {}),
    },
    select: { id: true },
  })
  return vendor?.id || null
}

function startOfDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1)
}

function startOfQuarter(d = new Date()) {
  const month = d.getMonth()
  const quarterStartMonth = Math.floor(month / 3) * 3
  return new Date(d.getFullYear(), quarterStartMonth, 1)
}

function buildExpensePeriodRange(query) {
  const now = new Date()
  const todayEnd = endOfDay(now)
  const period = String(query.period || '').toUpperCase()

  if (period === 'YEARLY') {
    return { period, dateFrom: startOfYear(now), dateTo: todayEnd, label: 'Yearly' }
  }
  if (period === 'QUARTERLY') {
    return { period, dateFrom: startOfQuarter(now), dateTo: todayEnd, label: 'Quarterly' }
  }
  if (period === 'MONTHLY') {
    return { period, dateFrom: startOfMonth(now), dateTo: todayEnd, label: 'Monthly' }
  }
  if (period === 'CUSTOM') {
    const from = parseQueryDateParam(query.date_from, 'date_from')
    const to = parseQueryDateParam(query.date_to, 'date_to')
    if (!from || !to) {
      const err = new Error('Custom period requires date_from and date_to')
      err.name = 'ZodError'
      err.errors = [{ message: 'Custom period requires date_from and date_to' }]
      throw err
    }
    if (from > to) {
      const err = new Error('Custom period start date cannot be after end date')
      err.name = 'ZodError'
      err.errors = [{ message: 'Custom period start date cannot be after end date' }]
      throw err
    }
    return { period, dateFrom: startOfDay(from), dateTo: endOfDay(to), label: 'Custom' }
  }

  return null
}

async function generateVoucherNumber(trustId, date = new Date()) {
  const year = new Date(date).getFullYear()
  const prefix = `TVT-EXP-${year}-`
  const latest = await prisma.expense.findFirst({
    where: { trust_id: trustId, voucher_number: { startsWith: prefix } },
    orderBy: { voucher_number: 'desc' },
    select: { voucher_number: true },
  })
  const last = latest?.voucher_number ? parseInt(latest.voucher_number.slice(-6), 10) : 0
  return `${prefix}${String(last + 1).padStart(6, '0')}`
}

function getFinancialYearLabel(date = new Date()) {
  const d = new Date(date)
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0')
  return `FY ${startYear}-${endYearShort}`
}

async function assignMissingVoucherNumbers(trustId) {
  const missing = await prisma.expense.findMany({
    where: { trust_id: trustId, voucher_number: null },
    orderBy: [{ expense_date: 'asc' }, { created_at: 'asc' }],
    select: { id: true, expense_date: true },
  })
  if (!missing.length) return

  for (const row of missing) {
    let assigned = false
    for (let attempt = 0; attempt < 3 && !assigned; attempt++) {
      const voucher_number = await generateVoucherNumber(trustId, row.expense_date)
      try {
        await prisma.expense.update({
          where: { id: row.id },
          data: { voucher_number },
        })
        assigned = true
      } catch (err) {
        if (err.code !== 'P2002' || attempt === 2) throw err
      }
    }
  }
}

function buildExpenseWhere(req) {
  const {
    category,
    search,
    date_from,
    date_to,
    expense_nature,
    payment_mode,
    verification_status,
    attachment_status,
    amount_min,
    amount_max,
  } = req.query

  const where = {
    trust_id: req.trustId,
  }
  const periodRange = buildExpensePeriodRange(req.query)

  if (category) {
    where.category = category
  }
  if (expense_nature) {
    where.expense_nature = expense_nature
  }
  if (payment_mode) {
    where.payment_mode = payment_mode
  }
  if (verification_status === 'VERIFIED') {
    where.is_reconciled = true
  } else if (verification_status === 'PENDING') {
    where.is_reconciled = false
  }
  if (attachment_status === 'ATTACHED') {
    where.attachment_url = { not: null }
  } else if (attachment_status === 'MISSING') {
    where.attachment_url = null
  }

  if (search) {
    where.OR = [
      { voucher_number: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { paid_to: { contains: search, mode: 'insensitive' } },
      { reference: { contains: search, mode: 'insensitive' } },
      { transaction_id: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (periodRange) {
    where.expense_date = { gte: periodRange.dateFrom, lte: periodRange.dateTo }
  } else {
    const fromDate = parseQueryDateParam(date_from, 'date_from')
    const toDate = parseQueryDateParam(date_to, 'date_to')
    if (fromDate && toDate) {
      where.expense_date = { gte: fromDate, lte: toDate }
    } else if (fromDate) {
      where.expense_date = { gte: fromDate }
    } else if (toDate) {
      where.expense_date = { lte: toDate }
    }
  }

  const minAmount = amount_min !== undefined ? parseFloat(amount_min) : undefined
  const maxAmount = amount_max !== undefined ? parseFloat(amount_max) : undefined
  if (Number.isFinite(minAmount) || Number.isFinite(maxAmount)) {
    where.amount = {}
    if (Number.isFinite(minAmount)) where.amount.gte = minAmount
    if (Number.isFinite(maxAmount)) where.amount.lte = maxAmount
  }

  return where
}

// GET /api/v1/expenses/categories
router.get('/categories', (req, res) => {
  const categories = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
    value,
    label,
  }))
  res.json({ success: true, categories })
})

// GET /api/v1/expenses
router.get('/', async (req, res, next) => {
  try {
    await assignMissingVoucherNumbers(req.trustId)
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25))
    const skip = (page - 1) * limit
    const where = buildExpenseWhere(req)
    const selectedPeriod = buildExpensePeriodRange(req.query)
    const fyAnchorDate = selectedPeriod?.dateTo || selectedPeriod?.dateFrom || new Date()
    const hasCategoryFilter = !!req.query.category

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const [total, expenses, aggregate, byCategoryRaw, channelSplit, verifiedCount, attachmentCount, highValueCount, verifiedAmountAgg] = await prisma.$transaction([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ expense_date: 'desc' }, { created_at: 'desc' }],
        include: {
          created_by_user: {
            select: { name: true, username: true },
          },
          reconciliation_logs: {
            orderBy: { created_at: 'desc' },
            take: 1,
            include: {
              reconciled_user: {
                select: { name: true, username: true },
              },
            },
          },
        },
      }),
      prisma.expense.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
      hasCategoryFilter
        ? Promise.resolve([])
        : prisma.expense.groupBy({
            by: ['category'],
            where,
            _sum: { amount: true },
            _count: { id: true },
          }),
      prisma.expense.groupBy({
        by: ['payment_channel'],
        where,
        _sum: { amount: true },
      }),
      prisma.expense.count({ where: { ...where, is_reconciled: true } }),
      prisma.expense.count({ where: { ...where, attachment_url: { not: null } } }),
      prisma.expense.count({ where: { AND: [where, { amount: { gte: HIGH_VALUE_THRESHOLD } }] } }),
      prisma.expense.aggregate({ where: { ...where, is_reconciled: true }, _sum: { amount: true } }),
    ])

    const by_category = byCategoryRaw
      .map((row) => ({
      category: row.category,
      label: CATEGORY_LABELS[row.category] || row.category,
      total_amount: row._sum.amount || 0,
      count: row._count.id || 0,
      }))
      .sort((a, b) => Number(b.total_amount) - Number(a.total_amount))

    const currentMonthTotal = await prisma.expense.aggregate({
      where: {
        trust_id: req.trustId,
        expense_date: { gte: monthStart },
      },
      _sum: { amount: true },
    })

    const cashTotal = channelSplit.find((c) => c.payment_channel === 'CASH')?._sum?.amount || 0
    const bankTotal = channelSplit.find((c) => c.payment_channel === 'BANK')?._sum?.amount || 0
    const totalAmount = Number(aggregate._sum.amount || 0)
    const expenseCount = aggregate._count.id || 0
    const pendingVerificationCount = Math.max(0, expenseCount - verifiedCount)
    const missingAttachmentCount = Math.max(0, expenseCount - attachmentCount)
    const verifiedAmount = Number(verifiedAmountAgg?._sum?.amount || 0)
    const pendingAmount = Math.max(0, totalAmount - verifiedAmount)
    const expensesWithMeta = expenses.map((expense) => {
      const latestReconciliation = expense.reconciliation_logs?.[0]
      return {
        ...expense,
        entered_by: expense.created_by_user?.name || expense.created_by_user?.username || 'System',
        verified_by: latestReconciliation?.reconciled_user?.name || latestReconciliation?.reconciled_user?.username || null,
        verification_date: latestReconciliation?.created_at || null,
      }
    })
    const totalPages = Math.ceil(total / limit)

    res.json({
      success: true,
      expenses: expensesWithMeta,
      summary: {
        total_amount: totalAmount,
        expense_count: expenseCount,
        this_month_amount: Number(currentMonthTotal._sum.amount || 0),
        cash_total: Number(cashTotal || 0),
        bank_total: Number(bankTotal || 0),
        largest_head: by_category[0]?.label || null,
        verified_count: verifiedCount,
        pending_verification_count: pendingVerificationCount,
        attached_count: attachmentCount,
        missing_attachment_count: missingAttachmentCount,
        high_value_count: highValueCount,
        financial_year: getFinancialYearLabel(fyAnchorDate),
        verified_amount: verifiedAmount,
        pending_amount: pendingAmount,
      },
      selected_period: selectedPeriod
        ? {
            period: selectedPeriod.period,
            label: selectedPeriod.label,
            date_from: selectedPeriod.dateFrom,
            date_to: selectedPeriod.dateTo,
          }
        : null,
      by_category,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/expenses
router.post('/', upload.single('attachment'), async (req, res, next) => {
  try {
    const body = {
      ...req.body,
      amount: parseFloat(req.body.amount),
      authorized_signatory: req.body.authorized_signatory === 'true',
    }
    const data = validate(expenseSchema, body)
    const payment_channel = mapPaymentChannel(data.payment_mode, data.payment_channel)

    const trust = await prisma.trust.findFirst({
      where: { id: req.trustId, is_active: true },
      select: { opening_cash_balance: true, opening_bank_balance: true },
    })

    // Cash-Book warning (as-of expense date)
    // Current balance = opening + donations (<= date) - expenses (<= date)
    const asOf = new Date(data.expense_date)

    const [donationsCash, donationsBank, expensesCash, expensesBank] = await Promise.all([
      prisma.donation.aggregate({
        where: { trust_id: req.trustId, is_deleted: false, payment_mode: 'CASH', donation_date: { lte: asOf } },
        _sum: { amount: true },
      }),
      prisma.donation.aggregate({
        where: {
          trust_id: req.trustId,
          is_deleted: false,
          payment_mode: { not: 'CASH' },
          donation_date: { lte: asOf },
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { trust_id: req.trustId, payment_channel: 'CASH', expense_date: { lte: asOf } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { trust_id: req.trustId, payment_channel: 'BANK', expense_date: { lte: asOf } },
        _sum: { amount: true },
      }),
    ])

    const openingCash = Number(trust?.opening_cash_balance || 0)
    const openingBank = Number(trust?.opening_bank_balance || 0)

    const cashBalance = openingCash + Number(donationsCash._sum.amount || 0) - Number(expensesCash._sum.amount || 0)
    const bankBalance = openingBank + Number(donationsBank._sum.amount || 0) - Number(expensesBank._sum.amount || 0)

    const projectedBalance =
      payment_channel === 'CASH' ? cashBalance - data.amount : bankBalance - data.amount

    const warning =
      projectedBalance < 0
        ? {
          type: payment_channel === 'CASH' ? 'CASH_NEGATIVE' : 'BANK_NEGATIVE',
          channel: payment_channel,
          current_balance: payment_channel === 'CASH' ? cashBalance : bankBalance,
          projected_balance: projectedBalance,
          message:
            payment_channel === 'CASH'
              ? `Warning: Cash balance will become negative. Current: ₹${cashBalance.toLocaleString('en-IN')} · After expense: ₹${projectedBalance.toLocaleString('en-IN')}`
              : `Warning: Bank balance will become negative. Current: ₹${bankBalance.toLocaleString('en-IN')} · After expense: ₹${projectedBalance.toLocaleString('en-IN')}`,
        }
        : null

    let expense
    for (let attempt = 0; attempt < 3; attempt++) {
      const voucher_number = await generateVoucherNumber(req.trustId, data.expense_date)
      try {
        expense = await prisma.expense.create({
          data: {
            trust_id: req.trustId,
            voucher_number,
            expense_date: new Date(data.expense_date),
            category: data.category,
            expense_nature: data.expense_nature || 'OPERATIONAL',
            amount: data.amount,
            description: data.description,
            paid_to: data.paid_to || null,
            vendor_mobile: data.vendor_mobile || null,
            payment_mode: data.payment_mode || 'CASH',
            upi_ref: data.upi_ref || null,
            cheque_number: data.cheque_number || null,
            transaction_id: data.transaction_id || null,
            reference: data.reference || null,
            bank_ref: data.transaction_id || data.reference || null,
            notes: data.notes || null,
            vendor_id: await resolveVendorId(req.trustId, data),
            payment_channel,
            attachment_url: req.file ? `/uploads/expense-bills/${req.file.filename}` : null,
            created_by: req.user.id,
          },
        })
        break
      } catch (createErr) {
        if (createErr.code === 'P2002' && attempt < 2) continue
        throw createErr
      }
    }

    logger.info('Expense created', { id: expense.id, trust: req.trustId })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'EXPENSES',
      action: 'CREATE',
      entity_type: 'Expense',
      entity_id: expense.id,
      description: `Expense created: ${expense.description}`,
      metadata: { amount: expense.amount, category: expense.category },
    })

    if (Number(expense.amount) >= 50000) {
      await createNotification({
        trust_id: req.trustId,
        type: 'EXPENSE',
        title: 'Large Expense Recorded',
        message: `An expense of ₹${Number(expense.amount).toLocaleString('en-IN')} was recorded (${expense.description})`,
        priority: 'HIGH',
      })
    }

    res.status(201).json({
      success: true,
      message: 'Expense voucher recorded successfully',
      expense,
      warning,
    })
  } catch (err) {
    next(err)
  }
})

// PUT /api/v1/expenses/:id
router.put('/:id', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        code: 'ADMIN_REQUIRED',
      })
    }

    const existing = await prisma.expense.findFirst({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
      },
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found',
        code: 'NOT_FOUND',
      })
    }

    const body = { ...req.body }
    if (body.amount !== undefined) body.amount = parseFloat(body.amount)
    const data = validate(expenseSchema, {
      expense_date: existing.expense_date.toISOString().slice(0, 10),
      category: existing.category,
      expense_nature: existing.expense_nature || 'OPERATIONAL',
      amount: Number(existing.amount),
      description: existing.description,
      paid_to: existing.paid_to,
      vendor_mobile: existing.vendor_mobile || '',
      payment_mode: existing.payment_mode || 'CASH',
      upi_ref: existing.upi_ref || '',
      cheque_number: existing.cheque_number || '',
      transaction_id: existing.transaction_id || '',
      reference: existing.reference,
      notes: existing.notes || '',
      payment_channel: body.payment_channel ?? existing.payment_channel,
      ...body,
    })
    const payment_channel = mapPaymentChannel(data.payment_mode, data.payment_channel)

    await prisma.expense.updateMany({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
      },
      data: {
        expense_date: new Date(data.expense_date),
        category: data.category,
        expense_nature: data.expense_nature || 'OPERATIONAL',
        amount: data.amount,
        description: data.description,
        paid_to: data.paid_to || null,
        vendor_mobile: data.vendor_mobile || null,
        payment_mode: data.payment_mode || 'CASH',
        upi_ref: data.upi_ref || null,
        cheque_number: data.cheque_number || null,
        transaction_id: data.transaction_id || null,
        reference: data.reference || null,
        bank_ref: data.transaction_id || data.reference || null,
        notes: data.notes || null,
        vendor_id: await resolveVendorId(req.trustId, data),
        payment_channel: payment_channel || existing.payment_channel,
      },
    })

    const expense = await prisma.expense.findFirst({
      where: { id: req.params.id, trust_id: req.trustId },
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'EXPENSES',
      action: 'UPDATE',
      entity_type: 'Expense',
      entity_id: expense.id,
      description: `Expense updated: ${expense.description}`,
      metadata: { amount: expense.amount, category: expense.category },
    })

    res.json({
      success: true,
      message: 'Expense updated successfully',
      expense,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/expenses/:id/voucher/pdf
router.get('/:id/voucher/pdf', async (req, res, next) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: { id: req.params.id, trust_id: req.trustId },
    })
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found', code: 'NOT_FOUND' })
    }

    const trust = await prisma.trust.findFirst({
      where: { id: req.trustId },
      select: { name: true, name_hindi: true, address: true, reg_number: true, pan_number: true },
    })

    const pdf = await generateExpenseVoucherPdf({
      trust: trust || {},
      expense,
      preparedBy: req.user?.name || req.user?.username || 'System',
    })

    const filename = `${(expense.voucher_number || `expense-${expense.id}`).replace(/\//g, '-')}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.send(pdf)
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/expenses/:id/reconcile
router.post('/:id/reconcile', async (req, res, next) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
      },
    })

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found',
        code: 'NOT_FOUND',
      })
    }

    if (expense.is_reconciled) {
      return res.status(400).json({
        success: false,
        message: 'Expense is already reconciled',
      })
    }

    await prisma.expense.updateMany({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
      },
      data: { is_reconciled: true },
    })

    await prisma.reconciliationLog.create({
      data: {
        trust_id: req.trustId,
        expense_id: expense.id,
        reconciled_by: req.user.id,
        remarks: req.body.remarks || null,
      },
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'EXPENSES',
      action: 'RECONCILE',
      entity_type: 'Expense',
      entity_id: expense.id,
      description: `Expense reconciled: ${expense.description}`,
      metadata: { amount: expense.amount },
    })

    res.json({
      success: true,
      message: 'Expense reconciled successfully',
    })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/v1/expenses/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        code: 'ADMIN_REQUIRED',
      })
    }

    const existing = await prisma.expense.findFirst({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
      },
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found',
        code: 'NOT_FOUND',
      })
    }

    await prisma.expense.deleteMany({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
      },
    })

    logger.info('Expense deleted', { id: req.params.id, trust: req.trustId })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'EXPENSES',
      action: 'DELETE',
      entity_type: 'Expense',
      entity_id: existing.id,
      description: `Expense deleted: ${existing.description}`,
      metadata: { amount: existing.amount, category: existing.category },
    })

    res.json({
      success: true,
      message: 'Expense deleted successfully',
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
