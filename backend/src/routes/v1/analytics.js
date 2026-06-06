const router = require('express').Router()
const fs = require('fs')
const path = require('path')
const prisma = require('../../lib/prisma')
const { getReceiptFilePath } = require('../../services/storage.service')
const { generateReconciliationPdf } = require('../../services/reconciliationExport.service')
const { generateAuditActivityPdf } = require('../../services/auditExport.service')
const { parseQueryDateParam } = require('../../utils/validators')

function num(val) {
  if (val == null) return 0
  return Number(val)
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

function endOfMonth(d = new Date()) {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1)
}

function endOfYear(d = new Date()) {
  return endOfDay(new Date(d.getFullYear(), 11, 31))
}

function startOfQuarter(d = new Date()) {
  const month = d.getMonth()
  const quarterStartMonth = Math.floor(month / 3) * 3
  return new Date(d.getFullYear(), quarterStartMonth, 1)
}

function endOfQuarter(d = new Date()) {
  const month = d.getMonth()
  const quarterStartMonth = Math.floor(month / 3) * 3
  return endOfDay(new Date(d.getFullYear(), quarterStartMonth + 3, 0))
}

function monthKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(key) {
  const [year, month] = key.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(month, 10) - 1]} ${year}`
}

function buildPeriodRange(query) {
  const now = new Date()
  const period = String(query.period || 'MONTHLY').toUpperCase()

  if (period === 'YEARLY') {
    return {
      period,
      dateFrom: startOfYear(now),
      dateTo: endOfYear(now),
      label: 'Yearly',
    }
  }

  if (period === 'QUARTERLY') {
    return {
      period,
      dateFrom: startOfQuarter(now),
      dateTo: endOfQuarter(now),
      label: 'Quarterly',
    }
  }

  if (period === 'CUSTOM') {
    const from = parseQueryDateParam(query.date_from, 'Custom period start date')
    const to = parseQueryDateParam(query.date_to, 'Custom period end date')
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
    return {
      period,
      dateFrom: startOfDay(from),
      dateTo: endOfDay(to),
      label: 'Custom',
    }
  }

  return {
    period: 'MONTHLY',
    dateFrom: startOfMonth(now),
    dateTo: endOfMonth(now),
    label: 'Monthly',
  }
}

function buildReconciliationPeriodRange(query) {
  const now = new Date()
  const period = String(query.period || '').toUpperCase()
  if (period === 'YEARLY') {
    return { period, label: 'Yearly', dateFrom: startOfYear(now), dateTo: endOfYear(now) }
  }
  if (period === 'QUARTERLY') {
    return { period, label: 'Quarterly', dateFrom: startOfQuarter(now), dateTo: endOfQuarter(now) }
  }
  if (period === 'MONTHLY') {
    return { period, label: 'Monthly', dateFrom: startOfMonth(now), dateTo: endOfMonth(now) }
  }
  if (period === 'CUSTOM') {
    const from = parseQueryDateParam(query.date_from, 'Custom period start date')
    const to = parseQueryDateParam(query.date_to, 'Custom period end date')
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
    return { period, label: 'Custom', dateFrom: startOfDay(from), dateTo: endOfDay(to) }
  }
  return null
}

async function loadTrust(trustId) {
  return prisma.trust.findUnique({
    where: { id: trustId },
    select: {
      id: true,
      name: true,
      name_hindi: true,
      address: true,
    },
  })
}

async function getReconciliationData(trustId, query) {
  const selectedPeriod = buildReconciliationPeriodRange(query)
  const donationDateFilter = selectedPeriod
    ? { donation_date: { gte: selectedPeriod.dateFrom, lte: selectedPeriod.dateTo } }
    : {}
  const expenseDateFilter = selectedPeriod
    ? { expense_date: { gte: selectedPeriod.dateFrom, lte: selectedPeriod.dateTo } }
    : {}
  const logDateFilter = selectedPeriod
    ? { created_at: { gte: selectedPeriod.dateFrom, lte: selectedPeriod.dateTo } }
    : {}
  const bankAccount = String(query.bank_account || 'ALL')
  const bankPendingOnly = bankAccount !== 'ALL'

  const [
    unreconciled_donations,
    unreconciled_expenses,
    donationTotal,
    expenseTotal,
    recent_reconciliation_logs,
    matchedDonationTotal,
    matchedExpenseTotal,
    matchedEntriesRaw,
  ] = await Promise.all([
    prisma.donation.findMany({
      where: {
        trust_id: trustId,
        is_deleted: false,
        is_reconciled: false,
        ...(bankPendingOnly ? { payment_mode: { not: 'CASH' } } : {}),
        ...donationDateFilter,
      },
      orderBy: [{ donation_date: 'desc' }, { created_at: 'desc' }],
      take: 50,
    }),
    prisma.expense.findMany({
      where: {
        trust_id: trustId,
        is_reconciled: false,
        ...(bankPendingOnly ? { payment_channel: 'BANK' } : {}),
        ...expenseDateFilter,
      },
      orderBy: [{ expense_date: 'desc' }, { created_at: 'desc' }],
      take: 50,
    }),
    prisma.donation.aggregate({
      where: {
        trust_id: trustId,
        is_deleted: false,
        is_reconciled: false,
        ...(bankPendingOnly ? { payment_mode: { not: 'CASH' } } : {}),
        ...donationDateFilter,
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.expense.aggregate({
      where: {
        trust_id: trustId,
        is_reconciled: false,
        ...(bankPendingOnly ? { payment_channel: 'BANK' } : {}),
        ...expenseDateFilter,
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.reconciliationLog.findMany({
      where: { trust_id: trustId, ...logDateFilter },
      orderBy: { created_at: 'desc' },
      take: 20,
      include: {
        reconciled_user: { select: { id: true, name: true } },
        donation: { select: { receipt_number: true, donor_name: true } },
        expense: { select: { description: true, category: true, voucher_number: true } },
      },
    }),
    prisma.donation.aggregate({
      where: {
        trust_id: trustId,
        is_deleted: false,
        is_reconciled: true,
        ...(bankPendingOnly ? { payment_mode: { not: 'CASH' } } : {}),
        ...donationDateFilter,
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.expense.aggregate({
      where: {
        trust_id: trustId,
        is_reconciled: true,
        ...(bankPendingOnly ? { payment_channel: 'BANK' } : {}),
        ...expenseDateFilter,
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.reconciliationLog.findMany({
      where: { trust_id: trustId, ...logDateFilter },
      orderBy: { created_at: 'desc' },
      take: 100,
      include: {
        reconciled_user: { select: { id: true, name: true } },
        donation: {
          select: {
            id: true,
            receipt_number: true,
            donor_name: true,
            amount: true,
            payment_mode: true,
            bank_ref: true,
            donation_date: true,
          },
        },
        expense: {
          select: {
            id: true,
            voucher_number: true,
            description: true,
            amount: true,
            payment_mode: true,
            bank_ref: true,
            expense_date: true,
          },
        },
      },
    }),
  ])

  const matched_entries = matchedEntriesRaw.map((log) => {
    if (log.donation) {
      return {
        id: log.id,
        entry_type: 'RECEIPT',
        voucher_ref: log.donation.receipt_number,
        particulars: `Donation — ${log.donation.donor_name}`,
        payment_mode: log.donation.payment_mode,
        bank_reference: log.donation.bank_ref || null,
        amount: log.donation.amount,
        status: 'MATCHED',
        matched_on: log.created_at,
        matched_by: log.reconciled_user?.name || 'System',
      }
    }
    return {
      id: log.id,
      entry_type: 'PAYMENT',
      voucher_ref: log.expense?.voucher_number || log.expense_id,
      particulars: `Expense — ${log.expense?.description || '-'}`,
      payment_mode: log.expense?.payment_mode || 'BANK',
      bank_reference: log.expense?.bank_ref || null,
      amount: log.expense?.amount || 0,
      status: 'MATCHED',
      matched_on: log.created_at,
      matched_by: log.reconciled_user?.name || 'System',
    }
  })

  const pendingDonationAmount = Number(donationTotal._sum.amount || 0)
  const pendingExpenseAmount = Number(expenseTotal._sum.amount || 0)
  const matchedAmount =
    Number(matchedDonationTotal._sum.amount || 0) + Number(matchedExpenseTotal._sum.amount || 0)
  const lastReconciliationDate = recent_reconciliation_logs?.[0]?.created_at || null

  return {
    unreconciled_donations,
    unreconciled_expenses,
    matched_entries,
    totals: {
      unreconciled_donation_count: donationTotal._count.id || 0,
      unreconciled_donation_amount: pendingDonationAmount,
      unreconciled_expense_count: expenseTotal._count.id || 0,
      unreconciled_expense_amount: pendingExpenseAmount,
      pending_receipts_count: donationTotal._count.id || 0,
      pending_payments_count: expenseTotal._count.id || 0,
      matched_count: (matchedDonationTotal._count.id || 0) + (matchedExpenseTotal._count.id || 0),
      matched_amount: matchedAmount,
      settlement_difference: pendingDonationAmount - pendingExpenseAmount,
      last_reconciliation_date: lastReconciliationDate,
    },
    recent_reconciliation_logs,
    monthly_reconciliation_status:
      (donationTotal._count.id || 0) + (expenseTotal._count.id || 0) > 0 ? 'Pending' : 'Closed',
    selected_period: selectedPeriod
      ? {
          period: selectedPeriod.period,
          label: selectedPeriod.label,
          date_from: selectedPeriod.dateFrom,
          date_to: selectedPeriod.dateTo,
        }
      : null,
    bank_accounts: [
      { value: 'ALL', label: 'All Bank Accounts' },
      { value: 'PRIMARY', label: 'Primary Bank Account' },
    ],
  }
}

function buildAuditWhere(trustId, query) {
  const { module, action, user_id, date_from, date_to, q, user_name } = query
  const where = { trust_id: trustId }
  if (module) where.module = module
  if (action) where.action = action
  if (user_id) where.user_id = user_id
  if (date_from || date_to) {
    where.created_at = {}
    if (date_from) where.created_at.gte = new Date(date_from)
    if (date_to) {
      const end = new Date(date_to)
      end.setHours(23, 59, 59, 999)
      where.created_at.lte = end
    }
  }
  if (q) {
    where.OR = [
      { description: { contains: q, mode: 'insensitive' } },
      { module: { contains: q, mode: 'insensitive' } },
      { action: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (user_name) {
    where.user = {
      OR: [
        { name: { contains: user_name, mode: 'insensitive' } },
        { username: { contains: user_name, mode: 'insensitive' } },
      ],
    }
  }
  return where
}

async function periodStats(trustId, dateFrom, dateTo) {
  const donationWhere = {
    trust_id: trustId,
    is_deleted: false,
    donation_date: { gte: dateFrom, lte: dateTo },
  }
  const expenseWhere = {
    trust_id: trustId,
    expense_date: { gte: dateFrom, lte: dateTo },
  }

  const [donationAgg, expenseAgg] = await prisma.$transaction([
    prisma.donation.aggregate({ where: donationWhere, _sum: { amount: true }, _count: { id: true } }),
    prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true }, _count: { id: true } }),
  ])

  const donation_amount = num(donationAgg._sum.amount)
  const expense_amount = num(expenseAgg._sum.amount)

  return {
    donations: donationAgg._count.id || 0,
    donation_amount,
    expenses: expenseAgg._count.id || 0,
    expense_amount,
    net: donation_amount - expense_amount,
  }
}

// GET /api/v1/analytics/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const trustId = req.trustId
    const now = new Date()
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)
    const monthStart = startOfMonth(now)
    const yearStart = startOfYear(now)
    const selectedRange = buildPeriodRange(req.query)

    const [today, this_month, this_year, selected_period] = await Promise.all([
      periodStats(trustId, todayStart, todayEnd),
      periodStats(trustId, monthStart, todayEnd),
      periodStats(trustId, yearStart, todayEnd),
      periodStats(trustId, selectedRange.dateFrom, selectedRange.dateTo),
    ])

    const donationWhere = { trust_id: trustId, is_deleted: false }
    const expenseWhere = { trust_id: trustId }

    const monthKeys = []
    const monthCursor = new Date(selectedRange.dateFrom.getFullYear(), selectedRange.dateFrom.getMonth(), 1)
    while (monthCursor <= selectedRange.dateTo) {
      monthKeys.push(monthKey(monthCursor))
      monthCursor.setMonth(monthCursor.getMonth() + 1)
    }
    if (monthKeys.length === 0) {
      monthKeys.push(monthKey(selectedRange.dateFrom))
    }

    const trendStart = new Date(selectedRange.dateFrom.getFullYear(), selectedRange.dateFrom.getMonth(), 1)
    const dailyStart = new Date(
      Math.max(
        selectedRange.dateFrom.getTime(),
        selectedRange.dateTo.getTime() - 29 * 24 * 60 * 60 * 1000
      )
    )

    const [donationsTrend, expensesTrend, paymentModes, expenseCategories, dailyDonations, topDonorsRaw, recentActivity, pendingReconciliation, receiptRegenerateCount, recentDonations, recentExpenses, recentExports] =
      await Promise.all([
        prisma.donation.findMany({
          where: {
            ...donationWhere,
            donation_date: { gte: trendStart, lte: selectedRange.dateTo },
          },
          select: { amount: true, donation_date: true },
        }),
        prisma.expense.findMany({
          where: {
            ...expenseWhere,
            expense_date: { gte: trendStart, lte: selectedRange.dateTo },
          },
          select: { amount: true, expense_date: true },
        }),
        prisma.donation.groupBy({
          by: ['payment_mode'],
          where: {
            ...donationWhere,
            donation_date: { gte: selectedRange.dateFrom, lte: selectedRange.dateTo },
          },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.expense.groupBy({
          by: ['category'],
          where: {
            ...expenseWhere,
            expense_date: { gte: selectedRange.dateFrom, lte: selectedRange.dateTo },
          },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.donation.findMany({
          where: {
            ...donationWhere,
            donation_date: { gte: dailyStart, lte: selectedRange.dateTo },
          },
          select: { amount: true, donation_date: true },
        }),
        prisma.donation.groupBy({
          by: ['donor_mobile'],
          where: {
            ...donationWhere,
            donation_date: { gte: selectedRange.dateFrom, lte: selectedRange.dateTo },
          },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.auditLog.findMany({
          where: {
            trust_id: trustId,
            created_at: { gte: selectedRange.dateFrom, lte: selectedRange.dateTo },
          },
          orderBy: { created_at: 'desc' },
          take: 15,
          include: { user: { select: { id: true, name: true, username: true } } },
        }),
        prisma.$transaction([
          prisma.donation.count({
            where: {
              trust_id: trustId,
              is_deleted: false,
              is_reconciled: false,
              donation_date: { gte: selectedRange.dateFrom, lte: selectedRange.dateTo },
            },
          }),
          prisma.expense.count({
            where: {
              trust_id: trustId,
              is_reconciled: false,
              expense_date: { gte: selectedRange.dateFrom, lte: selectedRange.dateTo },
            },
          }),
        ]),
        prisma.auditLog.count({
          where: {
            trust_id: trustId,
            action: 'RECEIPT_REGENERATE',
            created_at: { gte: selectedRange.dateFrom, lte: selectedRange.dateTo },
          },
        }),
        prisma.donation.findMany({
          where: {
            ...donationWhere,
            donation_date: { gte: selectedRange.dateFrom, lte: selectedRange.dateTo },
          },
          orderBy: [{ donation_date: 'desc' }, { created_at: 'desc' }],
          take: 6,
          select: {
            id: true,
            receipt_number: true,
            donor_name: true,
            amount: true,
            donation_date: true,
          },
        }),
        prisma.expense.findMany({
          where: {
            ...expenseWhere,
            expense_date: { gte: selectedRange.dateFrom, lte: selectedRange.dateTo },
          },
          orderBy: [{ expense_date: 'desc' }, { created_at: 'desc' }],
          take: 6,
          select: {
            id: true,
            voucher_number: true,
            description: true,
            amount: true,
            expense_date: true,
          },
        }),
        prisma.auditLog.findMany({
          where: {
            trust_id: trustId,
            module: 'REPORTS',
            action: { in: ['EXPORT', 'DOWNLOAD'] },
          },
          orderBy: { created_at: 'desc' },
          take: 6,
          select: {
            id: true,
            action: true,
            description: true,
            created_at: true,
            user: { select: { name: true, username: true } },
          },
        }),
      ])

    const donationByMonth = Object.fromEntries(monthKeys.map((k) => [k, 0]))
    const expenseByMonth = Object.fromEntries(monthKeys.map((k) => [k, 0]))

    donationsTrend.forEach((d) => {
      const k = monthKey(d.donation_date)
      if (donationByMonth[k] !== undefined) donationByMonth[k] += num(d.amount)
    })
    expensesTrend.forEach((e) => {
      const k = monthKey(e.expense_date)
      if (expenseByMonth[k] !== undefined) expenseByMonth[k] += num(e.amount)
    })

    const donation_vs_expense = monthKeys.map((k) => ({
      period: formatMonthLabel(k),
      donations: donationByMonth[k],
      expenses: expenseByMonth[k],
    }))

    const dailyMap = {}
    const dailyCursor = new Date(dailyStart)
    while (dailyCursor <= selectedRange.dateTo) {
      const d = new Date(dailyCursor)
      dailyMap[d.toISOString().slice(0, 10)] = 0
      dailyCursor.setDate(dailyCursor.getDate() + 1)
    }
    dailyDonations.forEach((d) => {
      const key = new Date(d.donation_date).toISOString().slice(0, 10)
      if (dailyMap[key] !== undefined) dailyMap[key] += num(d.amount)
    })
    const daily_donation_trend = Object.entries(dailyMap).map(([date, amount]) => ({
      date,
      amount,
    }))

    const paymentTotal = paymentModes.reduce((s, p) => s + num(p._sum.amount), 0)
    const payment_mode_distribution = paymentModes.map((p) => ({
      payment_mode: p.payment_mode,
      amount: num(p._sum.amount),
      count: p._count.id,
      percentage: paymentTotal > 0 ? Math.round((num(p._sum.amount) / paymentTotal) * 10000) / 100 : 0,
    }))

    const top_expense_categories = expenseCategories
      .map((c) => ({
        category: c.category,
        amount: num(c._sum.amount),
        count: c._count.id,
      }))
      .sort((a, b) => b.amount - a.amount)

    const topDonorsSorted = [...topDonorsRaw]
      .sort((a, b) => num(b._sum.amount) - num(a._sum.amount))
      .slice(0, 10)

    const top_donors = await Promise.all(
      topDonorsSorted.map(async (d) => {
        const info = await prisma.donation.findFirst({
          where: { ...donationWhere, donor_mobile: d.donor_mobile },
          orderBy: { donation_date: 'desc' },
          select: { donor_name: true, donor_city: true },
        })
        return {
          donor_mobile: d.donor_mobile,
          donor_name: info?.donor_name || '',
          donor_city: info?.donor_city || null,
          total_amount: d._sum.amount || 0,
          donation_count: d._count.id || 0,
        }
      })
    )

    res.json({
      success: true,
      today,
      this_month,
      this_year,
      selected_period: {
        ...selected_period,
        period: selectedRange.period,
        label: selectedRange.label,
        date_from: selectedRange.dateFrom.toISOString().slice(0, 10),
        date_to: selectedRange.dateTo.toISOString().slice(0, 10),
      },
      trends: {
        donation_vs_expense,
        daily_donation_trend,
      },
      charts: {
        donation_vs_expense,
        payment_mode_distribution,
        top_expense_categories,
        daily_donation_trend,
      },
      top_donors,
      recent_activity: recentActivity,
      recent_documents: {
        receipts: recentDonations.map((d) => ({
          id: d.id,
          ref: d.receipt_number,
          particulars: d.donor_name,
          amount: num(d.amount),
          date: d.donation_date,
          type: 'RECEIPT',
        })),
        vouchers: recentExpenses.map((e) => ({
          id: e.id,
          ref: e.voucher_number || e.id,
          particulars: e.description,
          amount: num(e.amount),
          date: e.expense_date,
          type: 'VOUCHER',
        })),
        exports: recentExports.map((e) => ({
          id: e.id,
          action: e.action,
          description: e.description,
          created_at: e.created_at,
          user: e.user?.name || e.user?.username || 'System',
          type: 'EXPORT',
        })),
      },
      pending_reconciliation: {
        donations: pendingReconciliation[0],
        expenses: pendingReconciliation[1],
        total: pendingReconciliation[0] + pendingReconciliation[1],
        period: selectedRange.period,
        label: selectedRange.label,
        date_from: selectedRange.dateFrom.toISOString().slice(0, 10),
        date_to: selectedRange.dateTo.toISOString().slice(0, 10),
      },
      risk_activity: {
        receipt_regenerate_count: receiptRegenerateCount,
        period: selectedRange.period,
        label: selectedRange.label,
        date_from: selectedRange.dateFrom.toISOString().slice(0, 10),
        date_to: selectedRange.dateTo.toISOString().slice(0, 10),
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/analytics/activity
router.get('/activity', async (req, res, next) => {
  try {
    const { page = 1, limit = 25 } = req.query
    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)))
    const skip = (pageNum - 1) * limitNum

    const where = buildAuditWhere(req.trustId, req.query)

    const [total, logs] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { created_at: 'desc' },
        include: { user: { select: { id: true, name: true, username: true } } },
      }),
    ])

    const totalPages = Math.ceil(total / limitNum)

    res.json({
      success: true,
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/analytics/activity/export/pdf
router.get('/activity/export/pdf', async (req, res, next) => {
  try {
    const where = buildAuditWhere(req.trustId, req.query)
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 1000,
      include: { user: { select: { id: true, name: true, username: true } } },
    })
    const trust = await prisma.trust.findUnique({
      where: { id: req.trustId },
      select: { name: true, name_hindi: true },
    })
    if (!trust) {
      return res.status(404).json({ success: false, message: 'Trust not found' })
    }
    const periodLine =
      req.query.date_from && req.query.date_to
        ? `${req.query.date_from} to ${req.query.date_to}`
        : 'All records'
    const buffer = await generateAuditActivityPdf({
      trustName: trust.name_hindi || trust.name,
      generatedBy: req.user?.name || req.user?.username || 'System',
      periodLine,
      logs,
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit_trail_register_${new Date().toISOString().slice(0, 10)}.pdf"`
    )
    res.send(buffer)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/analytics/notifications
router.get('/notifications', async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20))

    const notifications = await prisma.notification.findMany({
      where: { trust_id: req.trustId },
      orderBy: [{ is_read: 'asc' }, { created_at: 'desc' }],
      take: limit,
    })

    const unread_count = await prisma.notification.count({
      where: { trust_id: req.trustId, is_read: false },
    })

    res.json({ success: true, notifications, unread_count })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/analytics/notifications/:id/read
router.post('/notifications/:id/read', async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
      },
      data: { is_read: true },
    })

    if (result.count === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' })
    }

    res.json({ success: true, message: 'Notification marked as read' })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/analytics/reconciliation
router.get('/reconciliation', async (req, res, next) => {
  try {
    const reportData = await getReconciliationData(req.trustId, req.query)
    res.json({ success: true, ...reportData })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/analytics/reconciliation/export/pdf
router.get('/reconciliation/export/pdf', async (req, res, next) => {
  try {
    const trust = await loadTrust(req.trustId)
    if (!trust) {
      return res.status(404).json({ success: false, message: 'Trust not found' })
    }

    const reportData = await getReconciliationData(req.trustId, req.query)
    const selectedPeriod = reportData.selected_period
    const selectedPeriodLabel = selectedPeriod
      ? `${selectedPeriod.label} (${new Date(selectedPeriod.date_from).toLocaleDateString('en-IN')} - ${new Date(selectedPeriod.date_to).toLocaleDateString('en-IN')})`
      : 'All transactions'

    const buffer = await generateReconciliationPdf({
      trust,
      selectedPeriod: selectedPeriodLabel,
      generatedBy: req.user?.name || req.user?.username || 'System',
      totals: reportData.totals,
      pendingReceipts: reportData.unreconciled_donations,
      pendingPayments: reportData.unreconciled_expenses,
      matchedEntries: reportData.matched_entries,
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bank_reconciliation_register_${new Date().toISOString().slice(0, 10)}.pdf"`
    )
    res.send(buffer)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/analytics/system-health
router.get('/system-health', async (req, res, next) => {
  try {
    let database_status = 'ok'
    try {
      await prisma.trust.findFirst({
        where: { id: req.trustId },
        select: { id: true },
      })
    } catch {
      database_status = 'error'
    }

    const uploadsDir = path.join(__dirname, '../../../uploads/receipts')
    const uploads_folder_status = fs.existsSync(uploadsDir) ? 'ok' : 'missing'

    const [pending_notifications, pending_receipts] = await prisma.$transaction([
      prisma.notification.count({
        where: { trust_id: req.trustId, is_read: false },
      }),
      prisma.donation.count({
        where: {
          trust_id: req.trustId,
          is_deleted: false,
          OR: [{ receipt_pdf_path: null }, { whatsapp_sent: false }],
        },
      }),
    ])

    const mem = process.memoryUsage()

    res.json({
      success: true,
      server_time: new Date(),
      uptime: process.uptime(),
      memory_usage: {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external,
      },
      node_version: process.version,
      database_status,
      uploads_folder_status,
      pending_notifications,
      pending_receipts,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/analytics/receipt-status
router.get('/receipt-status', async (req, res, next) => {
  try {
    const donations = await prisma.donation.findMany({
      where: {
        trust_id: req.trustId,
        is_deleted: false,
      },
      select: {
        id: true,
        receipt_number: true,
        receipt_pdf_path: true,
        whatsapp_sent: true,
      },
    })

    let generated = 0
    let missing = 0
    let pending_whatsapp = 0

    for (const d of donations) {
      if (!d.whatsapp_sent) pending_whatsapp++

      let fileOk = false
      if (d.receipt_pdf_path) {
        const fullPath = path.join(__dirname, '../../../', d.receipt_pdf_path)
        fileOk = fs.existsSync(fullPath)
      }
      if (!fileOk && d.receipt_number) {
        const { filePath } = getReceiptFilePath(d.receipt_number)
        fileOk = fs.existsSync(filePath)
      }

      if (fileOk) {
        generated++
      } else {
        missing++
      }
    }

    res.json({
      success: true,
      total: donations.length,
      generated,
      missing,
      failed: missing,
      pending_whatsapp,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
