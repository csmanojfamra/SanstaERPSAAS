const router = require('express').Router()
const prisma = require('../../lib/prisma')
const { parseQueryDateParam } = require('../../utils/validators')
const { getCashbookData } = require('../../services/cashbook.service')
const {
  generateCashbookExcel,
  generateCashbookPdf,
} = require('../../services/cashbookExport.service')

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
  const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3
  return new Date(d.getFullYear(), quarterStartMonth, 1)
}

function buildPeriodRange(query) {
  const now = new Date()
  const period = String(query.period || '').toUpperCase()
  const dateTo = endOfDay(now)
  if (period === 'MONTHLY') return { period, label: 'Monthly', dateFrom: startOfMonth(now), dateTo }
  if (period === 'QUARTERLY') return { period, label: 'Quarterly', dateFrom: startOfQuarter(now), dateTo }
  if (period === 'YEARLY') return { period, label: 'Yearly', dateFrom: startOfYear(now), dateTo }
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
    return { period, label: 'Custom', dateFrom: startOfDay(from), dateTo: endOfDay(to) }
  }
  return null
}

function parseChannel(value) {
  const ch = (value || 'both').toUpperCase()
  if (!['CASH', 'BANK', 'BOTH'].includes(ch)) return null
  return ch === 'BOTH' ? 'both' : ch
}

async function loadTrust(trustId) {
  return prisma.trust.findFirst({
    where: { id: trustId, is_active: true },
    select: {
      name: true,
      name_hindi: true,
      address: true,
      reg_number: true,
      pan_number: true,
      phone: true,
      logo_url: true,
    },
  })
}

// GET /api/v1/cashbook?trustId=... (admin auth sets req.trustId)
router.get('/', async (req, res, next) => {
  try {
    const selectedPeriod = buildPeriodRange(req.query)
    const dateFrom = selectedPeriod?.dateFrom
      ? selectedPeriod.dateFrom.toISOString().slice(0, 10)
      : req.query.date_from
    const dateTo = selectedPeriod?.dateTo
      ? selectedPeriod.dateTo.toISOString().slice(0, 10)
      : req.query.date_to
    const cashbook = await getCashbookData(
      req.trustId,
      dateFrom,
      dateTo
    )

    res.json({
      success: true,
      cashbook,
      selected_period: selectedPeriod
        ? {
            period: selectedPeriod.period,
            label: selectedPeriod.label,
            date_from: selectedPeriod.dateFrom,
            date_to: selectedPeriod.dateTo,
          }
        : null,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/cashbook/export/excel?channel=both|CASH|BANK&date_from=&date_to=
router.get('/export/excel', async (req, res, next) => {
  try {
    const selectedPeriod = buildPeriodRange(req.query)
    const dateFrom = selectedPeriod?.dateFrom
      ? selectedPeriod.dateFrom.toISOString().slice(0, 10)
      : req.query.date_from
    const dateTo = selectedPeriod?.dateTo
      ? selectedPeriod.dateTo.toISOString().slice(0, 10)
      : req.query.date_to

    const channel = parseChannel(req.query.channel)
    if (!channel) {
      return res.status(400).json({
        success: false,
        message: 'Invalid channel. Use CASH, BANK, or both',
      })
    }

    const trust = await loadTrust(req.trustId)
    if (!trust) {
      return res.status(404).json({ success: false, message: 'Trust not found' })
    }

    const cashbook = await getCashbookData(
      req.trustId,
      dateFrom,
      dateTo
    )

    const buffer = await generateCashbookExcel({
      trust,
      cashbook,
      dateFrom,
      dateTo,
      channel,
    })

    const suffix = channel === 'both' ? 'cash_bank' : channel.toLowerCase()
    const datePart =
      req.query.date_from && req.query.date_to
        ? `_${req.query.date_from}_to_${req.query.date_to}`
        : ''

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cashbook_${suffix}${datePart}.xlsx"`
    )
    res.send(buffer)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/cashbook/export/pdf?channel=both|CASH|BANK&date_from=&date_to=
router.get('/export/pdf', async (req, res, next) => {
  try {
    const selectedPeriod = buildPeriodRange(req.query)
    const dateFrom = selectedPeriod?.dateFrom
      ? selectedPeriod.dateFrom.toISOString().slice(0, 10)
      : req.query.date_from
    const dateTo = selectedPeriod?.dateTo
      ? selectedPeriod.dateTo.toISOString().slice(0, 10)
      : req.query.date_to

    const channel = parseChannel(req.query.channel)
    if (!channel) {
      return res.status(400).json({
        success: false,
        message: 'Invalid channel. Use CASH, BANK, or both',
      })
    }

    const trust = await loadTrust(req.trustId)
    if (!trust) {
      return res.status(404).json({ success: false, message: 'Trust not found' })
    }

    const cashbook = await getCashbookData(
      req.trustId,
      dateFrom,
      dateTo
    )

    const buffer = await generateCashbookPdf({
      trust,
      cashbook,
      dateFrom,
      dateTo,
      channel,
      generatedBy: req.user?.name || req.user?.username || 'System',
    })

    const suffix = channel === 'both' ? 'cash_bank' : channel.toLowerCase()
    const datePart =
      req.query.date_from && req.query.date_to
        ? `_${req.query.date_from}_to_${req.query.date_to}`
        : ''

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cashbook_${suffix}${datePart}.pdf"`
    )
    res.send(buffer)
  } catch (err) {
    next(err)
  }
})

module.exports = router
