const router = require('express').Router()
const ExcelJS = require('exceljs')
const prisma = require('../../lib/prisma')
const { formatIndianNumber } = require('../../utils/hindiNumbers')
const { generateReportsPdf } = require('../../services/reportsPdf.service')

const CATEGORY_LABELS = {
  CONSTRUCTION: 'Construction',
  MATERIALS: 'Materials',
  LABOUR: 'Labour',
  PUJA: 'Puja',
  ADMIN: 'Administration',
  TRAVEL: 'Travel',
  FOOD: 'Food',
  OTHER: 'Other',
}

const PAYMENT_MODE_LABELS = {
  CASH: 'Cash',
  UPI: 'UPI',
  CHEQUE: 'Cheque',
  NEFT: 'NEFT',
  RTGS: 'RTGS',
  DD: 'Demand Draft',
  ONLINE: 'Online',
}

function requireDateParams(req, res) {
  const { date_from, date_to } = req.query

  if (!date_from || !date_to) {
    res.status(400).json({
      success: false,
      message: 'date_from and date_to are required',
    })
    return false
  }

  return true
}

function donationBaseWhere(trustId) {
  return {
    trust_id: trustId,
    is_deleted: false,
  }
}

function parseDateOnly(value) {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(value) {
  const d = new Date(value)
  d.setHours(23, 59, 59, 999)
  return d
}

async function getTrustFyPattern(trustId) {
  const trust = await prisma.trust.findFirst({
    where: { id: trustId },
    select: { receipt_prefix: true, current_fy: true, name: true, name_hindi: true },
  })
  if (!trust) return null
  return {
    trust,
    fyPattern: `${trust.receipt_prefix}/${trust.current_fy}/`,
  }
}

function decimalToNumber(val) {
  if (val == null) return 0
  return Number(val)
}

function monthKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildDateFilter(date_from, date_to, dateField) {
  if (!date_from || !date_to) return {}
  return {
    [dateField]: {
      gte: parseDateOnly(date_from),
      lte: endOfDay(date_to),
    },
  }
}

function formatMonthLabel(key) {
  const [year, month] = key.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(month, 10) - 1]} ${year}`
}

function last12MonthKeys() {
  const keys = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(monthKey(d))
  }
  return keys
}

// ─── Excel helpers ───────────────────────────────────────────────

const COLORS = {
  saffron: 'FFFF6B00',
  grey: 'FFE0E0E0',
  maroon: 'FF7B1C1C',
  cream: 'FFFFF8E7',
  white: 'FFFFFFFF',
  totalsBlue: 'FFB3D9FF',
}

function styleHeaderRow(row, bgArgb, fontSize = 11) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: fontSize }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
}

function applyTrustHeader(worksheet, trustName, metaLine, colCount) {
  worksheet.mergeCells(1, 1, 1, colCount)
  const titleCell = worksheet.getCell(1, 1)
  titleCell.value = trustName
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.saffron } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }

  worksheet.mergeCells(2, 1, 2, colCount)
  const metaCell = worksheet.getCell(2, 1)
  metaCell.value = metaLine
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grey } }
  metaCell.alignment = { vertical: 'middle', horizontal: 'center' }

  worksheet.getRow(3).height = 8
}

function autoWidthColumns(worksheet) {
  worksheet.columns.forEach((col) => {
    let maxLen = col.header ? String(col.header).length : 10
    col.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.value != null) {
        maxLen = Math.max(maxLen, String(cell.value).length)
      }
    })
    col.width = Math.min(maxLen + 4, 40)
  })
}

function addStyledDataSheet(worksheet, trustName, metaLine, headers, rows, totalsRow) {
  const colCount = headers.length
  applyTrustHeader(worksheet, trustName, metaLine, colCount)

  const headerRow = worksheet.getRow(4)
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h
  })
  styleHeaderRow(headerRow, COLORS.maroon)

  rows.forEach((rowValues, idx) => {
    const row = worksheet.getRow(5 + idx)
    const bg = idx % 2 === 0 ? COLORS.white : COLORS.cream
    rowValues.forEach((val, i) => {
      const cell = row.getCell(i + 1)
      cell.value = val
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    })
  })

  if (totalsRow) {
    const totalRowNum = 5 + rows.length
    const totalRow = worksheet.getRow(totalRowNum)
    totalsRow.forEach((val, i) => {
      const cell = totalRow.getCell(i + 1)
      cell.value = val
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalsBlue } }
      cell.font = { bold: true }
    })
  }

  worksheet.columns = headers.map((h) => ({ header: h, key: h }))
  autoWidthColumns(worksheet)
}

// GET /api/v1/reports/daily-summary
router.get('/daily-summary', async (req, res, next) => {
  try {
    const dateStr =
      req.query.date ||
      new Date().toISOString().slice(0, 10)

    const dayStart = parseDateOnly(dateStr)
    const dayEnd = endOfDay(dateStr)

    const where = {
      ...donationBaseWhere(req.trustId),
      donation_date: {
        gte: dayStart,
        lte: dayEnd,
      },
    }

    const [donations, aggregate, byPaymentMode, byPurpose] = await prisma.$transaction([
      prisma.donation.findMany({
        where,
        orderBy: { created_at: 'desc' },
      }),
      prisma.donation.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.donation.groupBy({
        by: ['payment_mode'],
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.donation.groupBy({
        by: ['purpose'],
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ])

    res.json({
      success: true,
      date: dateStr,
      total_amount: aggregate._sum.amount || 0,
      total_count: aggregate._count.id || 0,
      by_payment_mode: byPaymentMode.map((r) => ({
        payment_mode: r.payment_mode,
        label: PAYMENT_MODE_LABELS[r.payment_mode] || r.payment_mode,
        total_amount: r._sum.amount || 0,
        count: r._count.id || 0,
      })),
      by_purpose: byPurpose.map((r) => ({
        purpose: r.purpose,
        total_amount: r._sum.amount || 0,
        count: r._count.id || 0,
      })),
      donations,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/reports/date-range
router.get('/date-range', async (req, res, next) => {
  try {
    if (!requireDateParams(req, res)) return

    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25))
    const skip = (page - 1) * limit

    const where = {
      ...donationBaseWhere(req.trustId),
      donation_date: {
        gte: parseDateOnly(req.query.date_from),
        lte: endOfDay(req.query.date_to),
      },
    }

    const [total, donations, aggregate] = await prisma.$transaction([
      prisma.donation.count({ where }),
      prisma.donation.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ donation_date: 'desc' }, { created_at: 'desc' }],
      }),
      prisma.donation.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ])

    const totalPages = Math.ceil(total / limit)

    res.json({
      success: true,
      donations,
      summary: {
        total_amount: aggregate._sum.amount || 0,
        total_count: aggregate._count.id || 0,
      },
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

// GET /api/v1/reports/payment-mode-summary
router.get('/payment-mode-summary', async (req, res, next) => {
  try {
    if (!requireDateParams(req, res)) return

    const where = {
      ...donationBaseWhere(req.trustId),
      donation_date: {
        gte: parseDateOnly(req.query.date_from),
        lte: endOfDay(req.query.date_to),
      },
    }

    const [grouped, totalAgg] = await prisma.$transaction([
      prisma.donation.groupBy({
        by: ['payment_mode'],
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.donation.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ])

    const grandTotal = decimalToNumber(totalAgg._sum.amount)

    const modes = grouped.map((r) => {
      const amount = decimalToNumber(r._sum.amount)
      return {
        payment_mode: r.payment_mode,
        label: PAYMENT_MODE_LABELS[r.payment_mode] || r.payment_mode,
        total_amount: r._sum.amount || 0,
        total_count: r._count.id || 0,
        percentage_of_total:
          grandTotal > 0 ? Math.round((amount / grandTotal) * 10000) / 100 : 0,
      }
    })

    res.json({
      success: true,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      total_amount: totalAgg._sum.amount || 0,
      total_count: totalAgg._count.id || 0,
      by_payment_mode: modes,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/reports/expense-summary
router.get('/expense-summary', async (req, res, next) => {
  try {
    if (!requireDateParams(req, res)) return

    const where = {
      trust_id: req.trustId,
      expense_date: {
        gte: parseDateOnly(req.query.date_from),
        lte: endOfDay(req.query.date_to),
      },
    }

    const [expenses, grouped, aggregate] = await prisma.$transaction([
      prisma.expense.findMany({
        where,
        orderBy: [{ expense_date: 'desc' }, { created_at: 'desc' }],
      }),
      prisma.expense.groupBy({
        by: ['category'],
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.expense.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ])

    res.json({
      success: true,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      summary: {
        total_amount: aggregate._sum.amount || 0,
        expense_count: aggregate._count.id || 0,
      },
      by_category: grouped.map((r) => ({
        category: r.category,
        label: CATEGORY_LABELS[r.category] || r.category,
        total_amount: r._sum.amount || 0,
        count: r._count.id || 0,
      })),
      expenses,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/reports/trustee-contributions
router.get('/trustee-contributions', async (req, res, next) => {
  try {
    const trustees = await prisma.trustee.findMany({
      where: {
        trust_id: req.trustId,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
    })

    const grouped = await prisma.trusteeContribution.groupBy({
      by: ['trustee_id'],
      where: {
        trustee: { trust_id: req.trustId },
      },
      _sum: { amount: true },
      _count: { id: true },
      _max: { contribution_date: true },
    })

    const map = Object.fromEntries(grouped.map((g) => [g.trustee_id, g]))

    const rows = trustees.map((t) => {
      const g = map[t.id]
      return {
        name: t.name,
        role: t.role,
        total_amount: g?._sum.amount || 0,
        contribution_count: g?._count.id || 0,
        last_contribution_date: g?._max.contribution_date || null,
      }
    })

    rows.sort((a, b) => decimalToNumber(b.total_amount) - decimalToNumber(a.total_amount))

    const grandAgg = await prisma.trusteeContribution.aggregate({
      where: {
        trustee: { trust_id: req.trustId },
      },
      _sum: { amount: true },
    })

    res.json({
      success: true,
      trustees: rows,
      grand_total: grandAgg._sum.amount || 0,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/reports/donor-list
router.get('/donor-list', async (req, res, next) => {
  try {
    const where = {
      ...donationBaseWhere(req.trustId),
    }

    if (req.query.date_from && req.query.date_to) {
      where.donation_date = {
        gte: parseDateOnly(req.query.date_from),
        lte: endOfDay(req.query.date_to),
      }
    } else if (req.query.date_from) {
      where.donation_date = { gte: parseDateOnly(req.query.date_from) }
    } else if (req.query.date_to) {
      where.donation_date = { lte: endOfDay(req.query.date_to) }
    }

    if (req.query.min_amount) {
      where.amount = { gte: parseFloat(req.query.min_amount) }
    }

    const grouped = await prisma.donation.groupBy({
      by: ['donor_mobile'],
      where,
      _sum: { amount: true },
      _count: { id: true },
      _max: { donation_date: true },
    })

    const donors = await Promise.all(
      grouped.map(async (g) => {
        const latest = await prisma.donation.findFirst({
          where: {
            ...donationBaseWhere(req.trustId),
            donor_mobile: g.donor_mobile,
            ...(where.donation_date ? { donation_date: where.donation_date } : {}),
            ...(where.amount ? { amount: where.amount } : {}),
          },
          orderBy: { donation_date: 'desc' },
          select: {
            donor_name: true,
            donor_city: true,
            donor_email: true,
          },
        })

        return {
          donor_mobile: g.donor_mobile,
          donor_name: latest?.donor_name || '',
          donor_city: latest?.donor_city || null,
          donor_email: latest?.donor_email || null,
          total_amount: g._sum.amount || 0,
          donation_count: g._count.id || 0,
          last_donation_date: g._max.donation_date || null,
        }
      })
    )

    donors.sort((a, b) => decimalToNumber(b.total_amount) - decimalToNumber(a.total_amount))

    res.json({
      success: true,
      donors,
      total_donors: donors.length,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/reports/financial-summary
router.get('/financial-summary', async (req, res, next) => {
  try {
    const fyInfo = await getTrustFyPattern(req.trustId)
    if (!fyInfo) {
      return res.status(404).json({ success: false, message: 'Trust not found' })
    }

    const { fyPattern } = fyInfo
    const donationWhere = donationBaseWhere(req.trustId)
    const fyDonationWhere = {
      ...donationWhere,
      receipt_number: { startsWith: fyPattern },
    }

    const fyStartYear = parseInt(fyInfo.trust.current_fy.split('-')[0], 10)
    const fyStartDate = new Date(fyStartYear, 3, 1)

    const [
      donationsThisFy,
      donationsEver,
      expensesThisFy,
      trusteeTotal,
      topDonorsRaw,
      donationsForTrend,
      expensesForTrend,
    ] = await prisma.$transaction([
      prisma.donation.aggregate({
        where: fyDonationWhere,
        _sum: { amount: true },
      }),
      prisma.donation.aggregate({
        where: donationWhere,
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: {
          trust_id: req.trustId,
          expense_date: { gte: fyStartDate },
        },
        _sum: { amount: true },
      }),
      prisma.trusteeContribution.aggregate({
        where: { trustee: { trust_id: req.trustId } },
        _sum: { amount: true },
      }),
      prisma.donation.groupBy({
        by: ['donor_mobile'],
        where: donationWhere,
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.donation.findMany({
        where: donationWhere,
        select: { amount: true, donation_date: true },
      }),
      prisma.expense.findMany({
        where: { trust_id: req.trustId },
        select: { amount: true, expense_date: true },
      }),
    ])

    const topDonorsSorted = [...topDonorsRaw]
      .sort((a, b) => decimalToNumber(b._sum.amount) - decimalToNumber(a._sum.amount))
      .slice(0, 10)

    const top_10_donors = await Promise.all(
      topDonorsSorted.map(async (d) => {
        const info = await prisma.donation.findFirst({
          where: {
            ...donationWhere,
            donor_mobile: d.donor_mobile,
          },
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

    const monthKeys = last12MonthKeys()
    const donationByMonth = {}
    const expenseByMonth = {}
    monthKeys.forEach((k) => {
      donationByMonth[k] = 0
      expenseByMonth[k] = 0
    })

    donationsForTrend.forEach((d) => {
      const k = monthKey(d.donation_date)
      if (donationByMonth[k] !== undefined) {
        donationByMonth[k] += decimalToNumber(d.amount)
      }
    })

    expensesForTrend.forEach((e) => {
      const k = monthKey(e.expense_date)
      if (expenseByMonth[k] !== undefined) {
        expenseByMonth[k] += decimalToNumber(e.amount)
      }
    })

    const monthly_trend = monthKeys.map((k) => ({
      month: formatMonthLabel(k),
      donations: donationByMonth[k],
      expenses: expenseByMonth[k],
    }))

    const totalDonationsFy = decimalToNumber(donationsThisFy._sum.amount)
    const totalExpensesFy = decimalToNumber(expensesThisFy._sum.amount)

    res.json({
      success: true,
      total_donations_this_fy: donationsThisFy._sum.amount || 0,
      total_donations_ever: donationsEver._sum.amount || 0,
      total_expenses_this_fy: expensesThisFy._sum.amount || 0,
      net_balance: totalDonationsFy - totalExpensesFy,
      total_trustee_contributions: trusteeTotal._sum.amount || 0,
      top_10_donors,
      monthly_trend,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/reports/export-excel
router.get('/export-excel', async (req, res, next) => {
  try {
    const type = req.query.type || 'donations'
    const validTypes = ['donations', 'expenses', 'trustees', 'donors', 'full']
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Use one of: ${validTypes.join(', ')}`,
      })
    }

    const trust = await prisma.trust.findFirst({
      where: { id: req.trustId },
      select: { name: true, name_hindi: true, current_fy: true },
    })

    if (!trust) {
      return res.status(404).json({ success: false, message: 'Trust not found' })
    }

    const trustName = trust.name_hindi || trust.name
    const { date_from, date_to } = req.query
    const metaBase =
      date_from && date_to
        ? `Report period: ${date_from} to ${date_to}`
        : `Generated: ${new Date().toISOString().slice(0, 10)}`

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Fastlegal Technologies Pvt Ltd'
    workbook.created = new Date()

    const typesToBuild =
      type === 'full' ? ['donations', 'expenses', 'trustees', 'donors'] : [type]

    for (const sheetType of typesToBuild) {
      if (sheetType === 'donations') {
        const where = {
          ...donationBaseWhere(req.trustId),
        }
        if (date_from && date_to) {
          where.donation_date = {
            gte: parseDateOnly(date_from),
            lte: endOfDay(date_to),
          }
        }

        const donations = await prisma.donation.findMany({
          where,
          orderBy: [{ donation_date: 'desc' }, { created_at: 'desc' }],
        })

        const headers = [
          'Receipt No',
          'Date',
          'Donor Name',
          'Mobile',
          'City',
          'Amount',
          'Payment Mode',
          'Reference',
          'Purpose',
        ]

        let totalAmt = 0
        const rows = donations.map((d) => {
          const amt = decimalToNumber(d.amount)
          totalAmt += amt
          const ref = d.upi_ref || d.cheque_number || d.bank_ref || ''
          return [
            d.receipt_number,
            d.donation_date.toISOString().slice(0, 10),
            d.donor_name,
            d.donor_mobile,
            d.donor_city || '',
            amt,
            PAYMENT_MODE_LABELS[d.payment_mode] || d.payment_mode,
            ref,
            d.purpose,
          ]
        })

        const ws = workbook.addWorksheet('Donations')
        addStyledDataSheet(ws, trustName, metaBase, headers, rows, [
          'TOTAL',
          '',
          '',
          '',
          '',
          totalAmt,
          '',
          '',
          `${donations.length} records`,
        ])

        const amountCol = 6
        ws.getColumn(amountCol).numFmt = '₹#,##0.00'
        for (let r = 5; r < 5 + rows.length; r++) {
          ws.getRow(r).getCell(amountCol).numFmt = '₹#,##0.00'
        }
        ws.getRow(5 + rows.length).getCell(amountCol).numFmt = '₹#,##0.00'
      }

      if (sheetType === 'expenses') {
        const where = { trust_id: req.trustId }
        if (date_from && date_to) {
          where.expense_date = {
            gte: parseDateOnly(date_from),
            lte: endOfDay(date_to),
          }
        }

        const expenses = await prisma.expense.findMany({
          where,
          orderBy: [{ expense_date: 'desc' }, { created_at: 'desc' }],
        })

        const headers = ['Date', 'Category', 'Amount', 'Description', 'Paid To', 'Reference']
        let totalAmt = 0
        const rows = expenses.map((e) => {
          const amt = decimalToNumber(e.amount)
          totalAmt += amt
          return [
            e.expense_date.toISOString().slice(0, 10),
            CATEGORY_LABELS[e.category] || e.category,
            amt,
            e.description,
            e.paid_to || '',
            e.reference || '',
          ]
        })

        const ws = workbook.addWorksheet('Expenses')
        addStyledDataSheet(ws, trustName, metaBase, headers, rows, [
          'TOTAL',
          '',
          totalAmt,
          '',
          '',
          `${expenses.length} records`,
        ])
        ws.getColumn(3).numFmt = '₹#,##0.00'
      }

      if (sheetType === 'trustees') {
        const trustees = await prisma.trustee.findMany({
          where: { trust_id: req.trustId, is_active: true },
          orderBy: [{ display_order: 'asc' }, { name: 'asc' }],
        })

        const grouped = await prisma.trusteeContribution.groupBy({
          by: ['trustee_id'],
          where: { trustee: { trust_id: req.trustId } },
          _sum: { amount: true },
          _count: { id: true },
          _max: { contribution_date: true },
        })

        const map = Object.fromEntries(grouped.map((g) => [g.trustee_id, g]))

        const headers = [
          'Trustee Name',
          'Role',
          'Total Contribution',
          'Contribution Count',
          'Last Contribution',
        ]

        let grand = 0
        const rows = trustees.map((t) => {
          const g = map[t.id]
          const amt = decimalToNumber(g?._sum.amount)
          grand += amt
          return [
            t.name,
            t.role || '',
            amt,
            g?._count.id || 0,
            g?._max.contribution_date
              ? g._max.contribution_date.toISOString().slice(0, 10)
              : '',
          ]
        })

        const ws = workbook.addWorksheet('Trustees')
        addStyledDataSheet(ws, trustName, metaBase, headers, rows, [
          'TOTAL',
          '',
          grand,
          '',
          '',
        ])
        ws.getColumn(3).numFmt = '₹#,##0.00'
      }

      if (sheetType === 'donors') {
        const where = { ...donationBaseWhere(req.trustId) }
        if (date_from && date_to) {
          where.donation_date = {
            gte: parseDateOnly(date_from),
            lte: endOfDay(date_to),
          }
        }

        const grouped = await prisma.donation.groupBy({
          by: ['donor_mobile'],
          where,
          _sum: { amount: true },
          _count: { id: true },
          _max: { donation_date: true },
        })

        const headers = [
          'Donor Name',
          'Mobile',
          'City',
          'Total Amount',
          'Donation Count',
          'Last Donation',
        ]

        let grand = 0
        const rows = []
        for (const g of grouped) {
          const latest = await prisma.donation.findFirst({
            where: {
              ...donationBaseWhere(req.trustId),
              donor_mobile: g.donor_mobile,
              ...(where.donation_date ? { donation_date: where.donation_date } : {}),
            },
            orderBy: { donation_date: 'desc' },
            select: { donor_name: true, donor_city: true },
          })
          const amt = decimalToNumber(g._sum.amount)
          grand += amt
          rows.push([
            latest?.donor_name || '',
            g.donor_mobile,
            latest?.donor_city || '',
            amt,
            g._count.id || 0,
            g._max.donation_date
              ? g._max.donation_date.toISOString().slice(0, 10)
              : '',
          ])
        }

        rows.sort((a, b) => b[3] - a[3])

        const ws = workbook.addWorksheet('Donors')
        addStyledDataSheet(ws, trustName, metaBase, headers, rows, [
          'TOTAL',
          '',
          '',
          grand,
          '',
          `${rows.length} donors`,
        ])
        ws.getColumn(4).numFmt = '₹#,##0.00'
      }
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${type}_report.xlsx"`
    )

    await workbook.xlsx.write(res)
    res.end()
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/reports/export-pdf
router.get('/export-pdf', async (req, res, next) => {
  try {
    const type = String(req.query.type || 'donations').toLowerCase()
    const validTypes = ['donations', 'expenses', 'full', 'compliance', 'audit_pack']
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Use one of: ${validTypes.join(', ')}`,
      })
    }

    const { date_from, date_to } = req.query
    const donationWhere = {
      ...donationBaseWhere(req.trustId),
      ...buildDateFilter(date_from, date_to, 'donation_date'),
    }
    const expenseWhere = {
      trust_id: req.trustId,
      ...buildDateFilter(date_from, date_to, 'expense_date'),
    }

    const [trust, donations, expenses, trustees, donors, reconciliationPending] = await Promise.all([
      prisma.trust.findFirst({
        where: { id: req.trustId },
        select: { name: true, name_hindi: true },
      }),
      prisma.donation.findMany({
        where: donationWhere,
        orderBy: [{ donation_date: 'desc' }, { created_at: 'desc' }],
        take: 400,
      }),
      prisma.expense.findMany({
        where: expenseWhere,
        orderBy: [{ expense_date: 'desc' }, { created_at: 'desc' }],
        take: 400,
      }),
      prisma.trustee.findMany({
        where: { trust_id: req.trustId, is_active: true },
        select: { id: true, name: true, role: true },
      }),
      prisma.donation.groupBy({
        by: ['donor_mobile'],
        where: donationWhere,
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.$transaction([
        prisma.donation.count({ where: { trust_id: req.trustId, is_deleted: false, is_reconciled: false } }),
        prisma.expense.count({ where: { trust_id: req.trustId, is_reconciled: false } }),
      ]),
    ])

    if (!trust) {
      return res.status(404).json({ success: false, message: 'Trust not found' })
    }

    const trusteeIds = trustees.map((t) => t.id)
    const trusteeGrouped = trusteeIds.length
      ? await prisma.trusteeContribution.groupBy({
          by: ['trustee_id'],
          where: { trustee_id: { in: trusteeIds } },
          _sum: { amount: true },
          _count: { id: true },
        })
      : []
    const trusteeMap = Object.fromEntries(trusteeGrouped.map((g) => [g.trustee_id, g]))
    const trusteeRows = trustees.map((t) => ({
      name: t.name,
      role: t.role,
      total_amount: trusteeMap[t.id]?._sum.amount || 0,
      contribution_count: trusteeMap[t.id]?._count.id || 0,
    }))

    const donorRows = await Promise.all(
      donors
        .sort((a, b) => Number(b._sum.amount || 0) - Number(a._sum.amount || 0))
        .slice(0, 50)
        .map(async (d) => {
          const latest = await prisma.donation.findFirst({
            where: { ...donationWhere, donor_mobile: d.donor_mobile },
            orderBy: { donation_date: 'desc' },
            select: { donor_name: true, donor_city: true },
          })
          return {
            donor_name: latest?.donor_name || '',
            donor_mobile: d.donor_mobile,
            donor_city: latest?.donor_city || null,
            total_amount: d._sum.amount || 0,
            donation_count: d._count.id || 0,
          }
        })
    )

    const pdfBuffer = await generateReportsPdf({
      type,
      trustName: trust.name_hindi || trust.name,
      generatedBy: req.user?.name || req.user?.username || 'System',
      dateFrom: date_from,
      dateTo: date_to,
      donations,
      expenses,
      trustees: trusteeRows,
      donors: donorRows,
      reconciliation: {
        pending_receipts_count: reconciliationPending[0],
        pending_payments_count: reconciliationPending[1],
      },
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${type}_report_${new Date().toISOString().slice(0, 10)}.pdf"`
    )
    res.send(pdfBuffer)
  } catch (err) {
    next(err)
  }
})

module.exports = router
