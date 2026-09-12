const router = require('express').Router()
const { z } = require('zod')
const ExcelJS = require('exceljs')
const prisma = require('../../lib/prisma')
const { validate, parseQueryDateParam } = require('../../utils/validators')
const logger = require('../../utils/logger')
const { createAuditLog } = require('../../services/audit.service')
const { getAuditContext } = require('../../utils/auditContext')
const requireAdmin = require('../../middleware/requireAdmin')

const {
  ensureDefaultAccounts,
  createJournalEntry,
  backfillCurrentFY,
  getTrialBalance,
  getIncomeAndExpenditure,
  getStatementOfAffairs,
  getAccountLedger,
  getFYFromDate,
  getFYDateRange,
} = require('../../services/accounting.service')

const accountCreateSchema = z.object({
  code: z.string().min(2).max(10).regex(/^\d+$/, 'Account code must be numeric (e.g. 1010, 4020)'),
  name: z.string().min(2).max(120),
  account_type: z.enum(['ASSET', 'LIABILITY', 'CORPUS', 'INCOME', 'EXPENSE']),
  normal_balance: z.enum(['DEBIT', 'CREDIT']).optional(),
  description: z.string().max(255).optional().nullable(),
})

const accountUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(255).optional().nullable(),
  is_active: z.boolean().optional(),
})

const manualJournalLineSchema = z.object({
  account_id: z.string().min(1),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
  narration: z.string().max(255).optional().nullable(),
})

const manualJournalSchema = z.object({
  entry_date: z.string().or(z.date()),
  voucher_type: z.enum(['JOURNAL', 'RECEIPT', 'PAYMENT', 'CONTRA']).default('JOURNAL'),
  narration: z.string().min(3).max(500),
  lines: z.array(manualJournalLineSchema).min(2, 'At least 2 lines required for double-entry'),
})

// GET /api/v1/accounting/accounts
router.get('/accounts', async (req, res, next) => {
  try {
    const { type, is_active } = req.query
    await ensureDefaultAccounts(req.trustId)

    const where = { trust_id: req.trustId }
    if (type) where.account_type = String(type).toUpperCase()
    if (is_active !== undefined) where.is_active = is_active === 'true'

    const accounts = await prisma.account.findMany({
      where,
      orderBy: { code: 'asc' },
    })

    res.json({
      success: true,
      accounts,
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/accounting/accounts (Admin only)
router.post('/accounts', requireAdmin, async (req, res, next) => {
  try {
    const data = validate(accountCreateSchema, req.body)

    const normal = data.normal_balance || (
      ['ASSET', 'EXPENSE'].includes(data.account_type) ? 'DEBIT' : 'CREDIT'
    )

    const existing = await prisma.account.findUnique({
      where: {
        trust_id_code: {
          trust_id: req.trustId,
          code: data.code,
        },
      },
    })
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Account code ${data.code} already exists`,
      })
    }

    const account = await prisma.account.create({
      data: {
        trust_id: req.trustId,
        code: data.code,
        name: data.name,
        account_type: data.account_type,
        normal_balance: normal,
        description: data.description || null,
        is_system: false,
      },
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'ACCOUNTING',
      action: 'CREATE',
      entity_type: 'Account',
      entity_id: account.id,
      description: `Account created: [${account.code}] ${account.name}`,
    })

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      account,
    })
  } catch (err) {
    next(err)
  }
})

// PUT /api/v1/accounting/accounts/:id (Admin only)
router.put('/accounts/:id', requireAdmin, async (req, res, next) => {
  try {
    const data = validate(accountUpdateSchema, req.body)

    const existing = await prisma.account.findFirst({
      where: { id: req.params.id, trust_id: req.trustId },
    })
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Account not found' })
    }

    const updated = await prisma.account.update({
      where: { id: req.params.id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
      },
    })

    res.json({
      success: true,
      message: 'Account updated successfully',
      account: updated,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/accounting/journals
router.get('/journals', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 25,
      search,
      voucher_type,
      source_type,
      date_from,
      date_to,
      fy,
      is_reversed,
    } = req.query

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25))
    const skip = (pageNum - 1) * limitNum

    const where = { trust_id: req.trustId }

    if (voucher_type) where.voucher_type = String(voucher_type).toUpperCase()
    if (source_type) where.source_type = String(source_type).toUpperCase()
    if (fy) where.fy = fy
    if (is_reversed !== undefined) where.is_reversed = is_reversed === 'true'

    if (date_from || date_to) {
      where.entry_date = {}
      if (date_from) where.entry_date.gte = parseQueryDateParam(date_from, false)
      if (date_to) where.entry_date.lte = parseQueryDateParam(date_to, true)
    }

    if (search) {
      where.OR = [
        { entry_number: { contains: search, mode: 'insensitive' } },
        { narration: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: {
                select: { id: true, code: true, name: true, account_type: true },
              },
            },
          },
        },
        orderBy: [{ entry_date: 'desc' }, { created_at: 'desc' }],
        skip,
        take: limitNum,
      }),
      prisma.journalEntry.count({ where }),
    ])

    res.json({
      success: true,
      entries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/accounting/journals/:id
router.get('/journals/:id', async (req, res, next) => {
  try {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: req.params.id, trust_id: req.trustId },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    })

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Journal entry not found' })
    }

    res.json({ success: true, entry })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/accounting/journals (Create manual voucher)
router.post('/journals', async (req, res, next) => {
  try {
    const data = validate(manualJournalSchema, req.body)

    // Verify all account_ids belong to this trust
    const accountIds = [...new Set(data.lines.map((l) => l.account_id))]
    const validAccounts = await prisma.account.findMany({
      where: { id: { in: accountIds }, trust_id: req.trustId, is_active: true },
      select: { id: true },
    })

    if (validAccounts.length !== accountIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected accounts are invalid or inactive',
      })
    }

    const entry = await createJournalEntry({
      trustId: req.trustId,
      entryDate: data.entry_date,
      voucherType: data.voucher_type,
      narration: data.narration,
      sourceType: 'MANUAL',
      createdBy: req.user?.username || 'OPERATOR',
      lines: data.lines,
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'ACCOUNTING',
      action: 'CREATE',
      entity_type: 'JournalEntry',
      entity_id: entry.id,
      description: `Journal voucher created: ${entry.entry_number} (${entry.narration})`,
    })

    res.status(201).json({
      success: true,
      message: 'Journal voucher created successfully',
      entry,
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/accounting/journals/:id/reverse (Reverse manual voucher - Admin only)
router.post('/journals/:id/reverse', requireAdmin, async (req, res, next) => {
  try {
    const original = await prisma.journalEntry.findFirst({
      where: { id: req.params.id, trust_id: req.trustId },
      include: { lines: true },
    })

    if (!original) {
      return res.status(404).json({ success: false, message: 'Journal entry not found' })
    }
    if (original.is_reversed) {
      return res.status(400).json({ success: false, message: 'Journal entry is already reversed' })
    }

    const reversalLines = original.lines.map((l) => ({
      account_id: l.account_id,
      debit: Number(l.credit),
      credit: Number(l.debit),
      narration: `Reversal of ${original.entry_number}: ${l.narration || ''}`,
    }))

    const reversal = await createJournalEntry({
      trustId: req.trustId,
      entryDate: new Date(),
      voucherType: original.voucher_type,
      narration: `Reversal of voucher ${original.entry_number}`,
      sourceType: 'REVERSAL',
      sourceId: original.id,
      createdBy: req.user?.username || 'ADMIN',
      lines: reversalLines,
    })

    await prisma.journalEntry.update({
      where: { id: original.id },
      data: {
        is_reversed: true,
        reversed_by_id: reversal.id,
      },
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'ACCOUNTING',
      action: 'REVERSE',
      entity_type: 'JournalEntry',
      entity_id: original.id,
      description: `Journal voucher ${original.entry_number} reversed by ${reversal.entry_number}`,
    })

    res.json({
      success: true,
      message: `Journal voucher ${original.entry_number} reversed successfully`,
      reversal,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/accounting/ledger/:accountId
router.get('/ledger/:accountId', async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query
    const fromDate = date_from ? parseQueryDateParam(date_from, false) : undefined
    const toDate = date_to ? parseQueryDateParam(date_to, true) : undefined

    const ledger = await getAccountLedger(req.trustId, req.params.accountId, {
      fromDate,
      toDate,
    })

    res.json({
      success: true,
      ledger,
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/accounting/backfill (Admin only)
router.post('/backfill', requireAdmin, async (req, res, next) => {
  try {
    const result = await backfillCurrentFY(req.trustId, req.user?.username || 'ADMIN')

    await createAuditLog({
      ...getAuditContext(req),
      module: 'ACCOUNTING',
      action: 'BACKFILL',
      entity_type: 'JournalEntry',
      description: `Backfilled double-entry records for FY ${result.fy}: ${result.donationsPosted} donations, ${result.expensesPosted} expenses`,
    })

    res.json({
      success: true,
      message: `Accounting backfill complete for FY ${result.fy}`,
      result,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/accounting/reports/trial-balance
router.get('/reports/trial-balance', async (req, res, next) => {
  try {
    const { date_from, date_to, fy } = req.query
    const fromDate = date_from ? parseQueryDateParam(date_from, false) : undefined
    const toDate = date_to ? parseQueryDateParam(date_to, true) : undefined

    const report = await getTrialBalance(req.trustId, { fromDate, toDate, fy })

    res.json({
      success: true,
      report,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/accounting/reports/income-expenditure
router.get('/reports/income-expenditure', async (req, res, next) => {
  try {
    const { date_from, date_to, fy } = req.query
    const fromDate = date_from ? parseQueryDateParam(date_from, false) : undefined
    const toDate = date_to ? parseQueryDateParam(date_to, true) : undefined

    const report = await getIncomeAndExpenditure(req.trustId, { fromDate, toDate, fy })

    res.json({
      success: true,
      report,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/accounting/reports/statement-of-affairs
router.get('/reports/statement-of-affairs', async (req, res, next) => {
  try {
    const { as_of_date, fy } = req.query
    const asOfDate = as_of_date ? parseQueryDateParam(as_of_date, true) : undefined

    const report = await getStatementOfAffairs(req.trustId, { asOfDate, fy })

    res.json({
      success: true,
      report,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/accounting/reports/export/:reportType (Excel Export)
router.get('/reports/export/:reportType', async (req, res, next) => {
  try {
    const { reportType } = req.params
    const { date_from, date_to, as_of_date, fy } = req.query

    const trust = await prisma.trust.findUnique({
      where: { id: req.trustId },
      select: { name: true, name_hindi: true, current_fy: true },
    })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Sansta ERP'
    workbook.created = new Date()

    const fromDate = date_from ? parseQueryDateParam(date_from, false) : undefined
    const toDate = date_to ? parseQueryDateParam(date_to, true) : undefined
    const asOfDate = as_of_date ? parseQueryDateParam(as_of_date, true) : undefined
    const activeFY = fy || trust?.current_fy || getFYFromDate(new Date())

    const SAFFRON_COLOR = 'FFE65100'
    const MAROON_COLOR = 'FF7B1C1C'

    if (reportType === 'trial-balance') {
      const tb = await getTrialBalance(req.trustId, { fromDate, toDate, fy: activeFY })
      const ws = workbook.addWorksheet('Trial Balance')

      ws.columns = [
        { header: 'Code', key: 'code', width: 10 },
        { header: 'Account Name', key: 'name', width: 40 },
        { header: 'Type', key: 'account_type', width: 14 },
        { header: 'Debit Total (₹)', key: 'period_debit', width: 18 },
        { header: 'Credit Total (₹)', key: 'period_credit', width: 18 },
        { header: 'Net Debit (₹)', key: 'net_debit', width: 18 },
        { header: 'Net Credit (₹)', key: 'net_credit', width: 18 },
      ]

      ws.insertRow(1, [trust?.name_hindi ? `${trust.name} (${trust.name_hindi})` : trust?.name || 'Temple Trust'])
      ws.insertRow(2, [`Trial Balance — FY ${activeFY}`])
      ws.mergeCells('A1:G1')
      ws.mergeCells('A2:G2')
      ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
      ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SAFFRON_COLOR } }
      ws.getCell('A1').alignment = { horizontal: 'center' }
      ws.getCell('A2').font = { bold: true, size: 12 }
      ws.getCell('A2').alignment = { horizontal: 'center' }

      const headerRow = ws.getRow(3)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAROON_COLOR } }
      })

      for (const row of tb.rows) {
        ws.addRow({
          code: row.code,
          name: row.name,
          account_type: row.account_type,
          period_debit: row.period_debit,
          period_credit: row.period_credit,
          net_debit: row.net_debit,
          net_credit: row.net_credit,
        })
      }

      const totalRow = ws.addRow({
        code: 'TOTAL',
        name: 'Grand Totals',
        account_type: '',
        period_debit: tb.totals.period_debit,
        period_credit: tb.totals.period_credit,
        net_debit: tb.totals.net_debit,
        net_credit: tb.totals.net_credit,
      })
      totalRow.font = { bold: true }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename=Trial_Balance_${activeFY}.xlsx`)
      return workbook.xlsx.write(res).then(() => res.end())
    }

    if (reportType === 'income-expenditure') {
      const ie = await getIncomeAndExpenditure(req.trustId, { fromDate, toDate, fy: activeFY })
      const ws = workbook.addWorksheet('Income & Expenditure')

      ws.columns = [
        { header: 'Particulars', key: 'particulars', width: 45 },
        { header: 'Code', key: 'code', width: 12 },
        { header: 'Expenditure (₹)', key: 'expenditure', width: 20 },
        { header: 'Income (₹)', key: 'income', width: 20 },
      ]

      ws.insertRow(1, [trust?.name || 'Temple Trust'])
      ws.insertRow(2, [`Income & Expenditure Account — FY ${activeFY}`])
      ws.mergeCells('A1:D1')
      ws.mergeCells('A2:D2')
      ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
      ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SAFFRON_COLOR } }
      ws.getCell('A1').alignment = { horizontal: 'center' }
      ws.getCell('A2').font = { bold: true, size: 12 }
      ws.getCell('A2').alignment = { horizontal: 'center' }

      const headerRow = ws.getRow(3)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAROON_COLOR } }
      })

      // Section 1: Income
      const incSec = ws.addRow({ particulars: 'INCOME (आय)', code: '', expenditure: '', income: '' })
      incSec.font = { bold: true }
      for (const item of ie.income) {
        ws.addRow({ particulars: item.name, code: item.code, expenditure: '', income: item.amount })
      }
      const incTot = ws.addRow({ particulars: 'Total Income (कुल आय)', code: '', expenditure: '', income: ie.total_income })
      incTot.font = { bold: true }

      ws.addRow({})

      // Section 2: Expenditure
      const expSec = ws.addRow({ particulars: 'EXPENDITURE (व्यय)', code: '', expenditure: '', income: '' })
      expSec.font = { bold: true }
      for (const item of ie.expenditure) {
        ws.addRow({ particulars: item.name, code: item.code, expenditure: item.amount, income: '' })
      }
      const expTot = ws.addRow({ particulars: 'Total Expenditure (कुल व्यय)', code: '', expenditure: ie.total_expenditure, income: '' })
      expTot.font = { bold: true }

      ws.addRow({})

      // Surplus / Deficit
      const resultRow = ws.addRow({
        particulars: ie.is_surplus ? 'SURPLUS / EXCESS OF INCOME OVER EXPENDITURE' : 'DEFICIT / EXCESS OF EXPENDITURE OVER INCOME',
        code: '',
        expenditure: ie.is_surplus ? '' : Math.abs(ie.surplus_or_deficit),
        income: ie.is_surplus ? ie.surplus_or_deficit : '',
      })
      resultRow.font = { bold: true, size: 12 }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename=Income_Expenditure_${activeFY}.xlsx`)
      return workbook.xlsx.write(res).then(() => res.end())
    }

    if (reportType === 'statement-of-affairs') {
      const bs = await getStatementOfAffairs(req.trustId, { asOfDate, fy: activeFY })
      const ws = workbook.addWorksheet('Statement of Affairs')

      ws.columns = [
        { header: 'Liabilities & Funds', key: 'liab_name', width: 35 },
        { header: 'Amount (₹)', key: 'liab_amount', width: 18 },
        { header: 'Assets & Properties', key: 'asset_name', width: 35 },
        { header: 'Amount (₹)', key: 'asset_amount', width: 18 },
      ]

      ws.insertRow(1, [trust?.name || 'Temple Trust'])
      ws.insertRow(2, [`Statement of Affairs (Balance Sheet) — As of ${new Date(bs.as_of_date).toLocaleDateString('en-IN')}`])
      ws.mergeCells('A1:D1')
      ws.mergeCells('A2:D2')
      ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
      ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SAFFRON_COLOR } }
      ws.getCell('A1').alignment = { horizontal: 'center' }
      ws.getCell('A2').font = { bold: true, size: 12 }
      ws.getCell('A2').alignment = { horizontal: 'center' }

      const headerRow = ws.getRow(3)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAROON_COLOR } }
      })

      // Combine liabilities and assets rows side by side
      const leftRows = []
      leftRows.push({ title: 'CORPUS & TRUST FUNDS', bold: true })
      for (const item of bs.funds_and_liabilities.corpus_items) {
        leftRows.push({ name: item.name, amount: item.amount })
      }
      leftRows.push({ name: 'Accumulated Surplus (Opening)', amount: bs.funds_and_liabilities.accumulated_surplus })
      leftRows.push({ name: 'Current Period Surplus / (Deficit)', amount: bs.funds_and_liabilities.current_surplus_or_deficit })
      leftRows.push({ title: 'CURRENT LIABILITIES', bold: true })
      for (const item of bs.funds_and_liabilities.liabilities_items) {
        leftRows.push({ name: item.name, amount: item.amount })
      }

      const rightRows = []
      rightRows.push({ title: 'ASSETS & INVESTMENTS', bold: true })
      for (const item of bs.assets.items) {
        rightRows.push({ name: item.name, amount: item.amount })
      }

      const maxLen = Math.max(leftRows.length, rightRows.length)
      for (let i = 0; i < maxLen; i++) {
        const l = leftRows[i]
        const r = rightRows[i]
        const row = ws.addRow({
          liab_name: l ? (l.title || l.name) : '',
          liab_amount: l && l.amount !== undefined ? l.amount : '',
          asset_name: r ? (r.title || r.name) : '',
          asset_amount: r && r.amount !== undefined ? r.amount : '',
        })
        if (l?.bold || r?.bold) {
          row.font = { bold: true }
        }
      }

      const totalsRow = ws.addRow({
        liab_name: 'Total Funds & Liabilities',
        liab_amount: bs.funds_and_liabilities.total,
        asset_name: 'Total Assets',
        asset_amount: bs.assets.total,
      })
      totalsRow.font = { bold: true, size: 12 }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename=Statement_Of_Affairs_${activeFY}.xlsx`)
      return workbook.xlsx.write(res).then(() => res.end())
    }

    return res.status(400).json({ success: false, message: 'Invalid reportType' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
