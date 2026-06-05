const router = require('express').Router()
const fs = require('fs')
const path = require('path')

const prisma = require('../../lib/prisma')
const { generateReceiptNumber } = require('../../services/receiptNumber.service')
const { generateReceiptBuffer } = require('../../services/receipt.service')
const { saveReceiptPDF, receiptExists, getReceiptFilePath } = require('../../services/storage.service')
const { sendReceiptWhatsApp } = require('../../services/whatsapp.service')
const {
  donationSchema,
  validate,
  validateDonationUpdate,
  parseQueryDateParam,
} = require('../../utils/validators')
const logger = require('../../utils/logger')
const { createAuditLog } = require('../../services/audit.service')
const { createNotification } = require('../../services/notification.service')
const { getAuditContext } = require('../../utils/auditContext')

function donationAmount(d) {
  return Number(d.amount) || 0
}

const HIGH_VALUE_THRESHOLD = Number(process.env.DONATION_HIGH_VALUE_THRESHOLD || 50000)
const CASH_MODES = new Set(['CASH'])
const BANK_MODES = new Set(['UPI', 'CHEQUE', 'NEFT', 'RTGS', 'DD', 'ONLINE'])

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

function startOfFinancialYear(d = new Date()) {
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  return new Date(year, 3, 1)
}

function enrichDonationRow(donation, donorCountMap) {
  const count = donorCountMap.get(donation.donor_mobile) || 1
  const amount = donationAmount(donation)
  const receiptGenerated = Boolean(donation.receipt_pdf_path)
  const statuses = []
  if (receiptGenerated) statuses.push('RECEIPT_GENERATED')
  else statuses.push('RECEIPT_PENDING')
  if (donation.whatsapp_sent) statuses.push('WHATSAPP_SENT')
  if (donation.email_sent) statuses.push('EMAIL_SENT')
  if (donation.receipt_sent_at) statuses.push('PRINTED')
  if (
    receiptGenerated &&
    donation.updated_at &&
    donation.created_at &&
    new Date(donation.updated_at).getTime() - new Date(donation.created_at).getTime() > 120000
  ) {
    statuses.push('REGENERATED')
  }

  return {
    ...donation,
    amount: donation.amount,
    donor_donation_count: count,
    donor_frequency: count > 1 ? 'REPEAT' : 'NEW',
    receipt_statuses: statuses,
    is_high_value: amount >= HIGH_VALUE_THRESHOLD,
    pan_recommended: amount >= HIGH_VALUE_THRESHOLD && !donation.pan_number,
    verification_recommended: amount >= HIGH_VALUE_THRESHOLD,
  }
}

function getReceiptFullPath(receiptPdfPath) {
  return path.join(__dirname, '../../../', receiptPdfPath)
}

async function generateAndUploadReceipt(donation, trust) {
  try {
    const pdfBuffer = await generateReceiptBuffer(donation, trust)

    const { url } = saveReceiptPDF(donation.receipt_number, pdfBuffer)

    await prisma.donation.updateMany({
      where: {
        id: donation.id,
        trust_id: trust.id,
      },
      data: {
        receipt_pdf_path: url,
        receipt_sent_at: new Date(),
      },
    })

    logger.info('Receipt generated', {
      receipt: donation.receipt_number,
    })

    return url
  } catch (err) {
    logger.error('Receipt generation failed', {
      receipt: donation.receipt_number,
      error: err.message,
    })

    await createNotification({
      trust_id: trust.id,
      type: 'RECEIPT',
      title: 'Receipt Generation Failed',
      message: `Failed to generate receipt for ${donation.receipt_number}`,
      priority: 'HIGH',
    })

    return null
  }
}

async function ensureReceiptAvailable(donation, trust) {
  if (donation.receipt_pdf_path) {
    const fullPath = getReceiptFullPath(donation.receipt_pdf_path)
    if (fs.existsSync(fullPath)) {
      return donation.receipt_pdf_path
    }
  }

  if (receiptExists(donation.receipt_number)) {
    const { publicPath } = getReceiptFilePath(donation.receipt_number)
    await prisma.donation.updateMany({
      where: { id: donation.id, trust_id: trust.id },
      data: { receipt_pdf_path: publicPath },
    })
    return publicPath
  }

  return generateAndUploadReceipt(donation, trust)
}

// POST /api/v1/donations
router.post('/', async (req, res, next) => {
  try {
    const body = { ...req.body, amount: parseFloat(req.body.amount) }
    const data = validate(donationSchema, body)

    const donation = await prisma.$transaction(async (tx) => {
      const receipt_number = await generateReceiptNumber(req.trustId, tx)

      return tx.donation.create({
        data: {
          trust_id: req.trustId,
          receipt_number,
          donor_name: data.donor_name,
          donor_mobile: data.donor_mobile,
          donor_city: data.donor_city || null,
          donor_email: data.donor_email || null,
          donor_address: data.donor_address || null,
          donor_state: data.donor_state || null,
          donor_pincode: data.donor_pincode || null,
          donor_type: data.donor_type || 'INDIVIDUAL',
          is_corpus: Boolean(data.is_corpus),
          amount: data.amount,
          payment_mode: data.payment_mode,
          upi_ref: data.upi_ref || null,
          cheque_number: data.cheque_number || null,
          bank_ref: data.bank_ref || null,
          purpose: data.purpose,
          donation_date: new Date(data.donation_date),
          notes: data.notes || null,
          pan_number: data.pan_number || null,
          created_by: req.user.id,
        },
      })
    })

    logger.info('Donation created', {
      receipt: donation.receipt_number,
      amount: donation.amount,
      trust: req.trustId,
    })

    const ctx = getAuditContext(req)
    await createAuditLog({
      ...ctx,
      module: 'DONATIONS',
      action: 'CREATE',
      entity_type: 'Donation',
      entity_id: donation.id,
      description: `Donation created: ${donation.receipt_number}`,
      metadata: {
        amount: donation.amount,
        donor: donation.donor_name,
        receipt_number: donation.receipt_number,
      },
    })

    const threshold = req.trust.donor_threshold ?? 1100
    if (donationAmount(donation) >= threshold) {
      await createNotification({
        trust_id: req.trustId,
        type: 'DONATION',
        title: 'Large Donation Received',
        message: `A donation of ₹${donationAmount(donation).toLocaleString('en-IN')} was received from ${donation.donor_name}`,
        priority: 'HIGH',
      })
    }

    await generateAndUploadReceipt(donation, req.trust)

    res.status(201).json({
      success: true,
      message: 'Donation recorded successfully',
      donation,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/donations
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 25,
      search,
      date_from,
      date_to,
      payment_mode,
      purpose,
      amount_min,
      amount_max,
      receipt_number,
      donor_mobile,
      receipt_status,
      donor_frequency,
    } = req.query

    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)))
    const skip = (pageNum - 1) * limitNum
    const baseWhere = { trust_id: req.trustId, is_deleted: false }
    const where = { ...baseWhere }

    if (search) {
      where.OR = [
        { donor_name: { contains: search, mode: 'insensitive' } },
        { donor_mobile: { contains: search } },
        { receipt_number: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (receipt_number) {
      where.receipt_number = { contains: receipt_number, mode: 'insensitive' }
    }

    if (donor_mobile) {
      where.donor_mobile = { contains: String(donor_mobile).replace(/\D/g, '') }
    }

    const fromDate = parseQueryDateParam(date_from, 'date_from')
    const toDate = parseQueryDateParam(date_to, 'date_to')
    if (fromDate && toDate) {
      where.donation_date = { gte: fromDate, lte: toDate }
    } else if (fromDate) {
      where.donation_date = { gte: fromDate }
    } else if (toDate) {
      where.donation_date = { lte: toDate }
    }

    if (payment_mode) {
      where.payment_mode = payment_mode
    }

    if (purpose) {
      where.purpose = { contains: purpose, mode: 'insensitive' }
    }

    if (amount_min || amount_max) {
      where.amount = {}
      if (amount_min) where.amount.gte = parseFloat(amount_min)
      if (amount_max) where.amount.lte = parseFloat(amount_max)
    }

    const status = String(receipt_status || '').toUpperCase()
    if (status === 'RECEIPT_GENERATED') where.receipt_pdf_path = { not: null }
    if (status === 'RECEIPT_PENDING') where.receipt_pdf_path = null
    if (status === 'WHATSAPP_SENT') where.whatsapp_sent = true
    if (status === 'EMAIL_SENT') where.email_sent = true

    const donorGroups = await prisma.donation.groupBy({
      by: ['donor_mobile'],
      where: baseWhere,
      _count: { id: true },
    })
    const donorCountMap = new Map(donorGroups.map((g) => [g.donor_mobile, g._count.id]))
    const repeatMobiles = donorGroups.filter((g) => g._count.id > 1).map((g) => g.donor_mobile)

    const freq = String(donor_frequency || '').toUpperCase()
    if (freq === 'NEW') {
      where.donor_mobile = { notIn: repeatMobiles.length ? repeatMobiles : ['__none__'] }
    } else if (freq === 'REPEAT') {
      where.donor_mobile = { in: repeatMobiles.length ? repeatMobiles : ['__none__'] }
    }

    const now = new Date()
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)

    const [
      total,
      donations,
      aggregate,
      todayAgg,
      monthAgg,
      donorDistinct,
      cashAgg,
      bankAgg,
      filteredForAnalytics,
    ] = await prisma.$transaction([
      prisma.donation.count({ where }),
      prisma.donation.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ donation_date: 'desc' }, { created_at: 'desc' }],
      }),
      prisma.donation.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
        _avg: { amount: true },
      }),
      prisma.donation.aggregate({
        where: { ...baseWhere, donation_date: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.donation.aggregate({
        where: { ...baseWhere, donation_date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.donation.groupBy({
        by: ['donor_mobile'],
        where: baseWhere,
        _count: { id: true },
      }),
      prisma.donation.aggregate({
        where: { ...baseWhere, payment_mode: 'CASH' },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.donation.aggregate({
        where: { ...baseWhere, payment_mode: { in: [...BANK_MODES] } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.donation.findMany({
        where,
        select: {
          id: true,
          receipt_number: true,
          donor_name: true,
          donor_mobile: true,
          amount: true,
          purpose: true,
          payment_mode: true,
        },
      }),
    ])

    const enriched = donations.map((d) => enrichDonationRow(d, donorCountMap))

    let largest = null
    let topDonor = null
    const purposeCounts = {}
    const modeCounts = {}
    filteredForAnalytics.forEach((d) => {
      const amt = donationAmount(d)
      if (!largest || amt > donationAmount(largest)) largest = d
      purposeCounts[d.purpose] = (purposeCounts[d.purpose] || 0) + 1
      modeCounts[d.payment_mode] = (modeCounts[d.payment_mode] || 0) + 1
    })
    const donorTotals = {}
    filteredForAnalytics.forEach((d) => {
      donorTotals[d.donor_mobile] = (donorTotals[d.donor_mobile] || 0) + donationAmount(d)
    })
    const topDonorMobile = Object.entries(donorTotals).sort((a, b) => b[1] - a[1])[0]
    if (topDonorMobile) {
      const sample = filteredForAnalytics.find((d) => d.donor_mobile === topDonorMobile[0])
      topDonor = {
        donor_name: sample?.donor_name,
        donor_mobile: topDonorMobile[0],
        total_amount: topDonorMobile[1],
      }
    }
    const topPurpose = Object.entries(purposeCounts).sort((a, b) => b[1] - a[1])[0]
    const topMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]

    const totalPages = Math.ceil(total / limitNum)

    res.json({
      success: true,
      donations: enriched,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      summary: {
        totalAmount: aggregate._sum.amount || 0,
        totalCount: aggregate._count.id || 0,
        averageAmount: aggregate._avg.amount || 0,
      },
      kpis: {
        today: {
          amount: todayAgg._sum.amount || 0,
          count: todayAgg._count.id || 0,
        },
        month: {
          amount: monthAgg._sum.amount || 0,
          count: monthAgg._count.id || 0,
        },
        totalDonors: donorDistinct.length,
        averageDonation: aggregate._avg.amount || 0,
        cash: {
          amount: cashAgg._sum.amount || 0,
          count: cashAgg._count.id || 0,
        },
        bank: {
          amount: bankAgg._sum.amount || 0,
          count: bankAgg._count.id || 0,
        },
      },
      analytics: {
        largest_donation: largest
          ? {
              amount: largest.amount,
              donor_name: largest.donor_name,
              receipt_number: largest.receipt_number,
            }
          : null,
        top_donor: topDonor,
        top_purpose: topPurpose ? { purpose: topPurpose[0], count: topPurpose[1] } : null,
        top_payment_mode: topMode ? { payment_mode: topMode[0], count: topMode[1] } : null,
      },
      thresholds: {
        high_value: HIGH_VALUE_THRESHOLD,
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/donations/:id/detail
router.get('/:id/detail', async (req, res, next) => {
  try {
    const donation = await prisma.donation.findFirst({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
        is_deleted: false,
      },
    })

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found',
        code: 'NOT_FOUND',
      })
    }

    const [donorGroups, audit_history] = await Promise.all([
      prisma.donation.groupBy({
        by: ['donor_mobile'],
        where: { trust_id: req.trustId, is_deleted: false },
        _count: { id: true },
      }),
      prisma.auditLog.findMany({
        where: {
          trust_id: req.trustId,
          module: 'DONATIONS',
          entity_id: donation.id,
        },
        orderBy: { created_at: 'desc' },
        take: 25,
        include: {
          user: { select: { id: true, name: true, username: true, role: true } },
        },
      }),
    ])
    const donorCountMap = new Map(donorGroups.map((g) => [g.donor_mobile, g._count.id]))

    res.json({
      success: true,
      donation: enrichDonationRow(donation, donorCountMap),
      audit_history,
      communication: {
        whatsapp_sent: donation.whatsapp_sent,
        whatsapp_sent_at: donation.whatsapp_sent_at,
        email_sent: donation.email_sent,
        receipt_sent_at: donation.receipt_sent_at,
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/donations/:id/receipt
router.get('/:id/receipt', async (req, res, next) => {
  try {
    const donation = await prisma.donation.findFirst({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
        is_deleted: false,
      },
    })

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found',
        code: 'NOT_FOUND',
      })
    }

    logger.info('Receipt requested', {
      receipt: donation.receipt_number,
    })

    const receiptPath = await ensureReceiptAvailable(donation, req.trust)

    if (!receiptPath) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate receipt PDF',
        code: 'RECEIPT_GENERATION_FAILED',
      })
    }

    const receipt_url = `${process.env.PUBLIC_URL || ''}${receiptPath}`

    // ?format=json — return URL only (e.g. integrations)
    if (req.query.format === 'json') {
      return res.json({
        success: true,
        receipt_url,
        receipt_number: donation.receipt_number,
      })
    }

    const fullPath = getReceiptFullPath(receiptPath)
    if (!fs.existsSync(fullPath)) {
      return res.status(500).json({
        success: false,
        message: 'Receipt file not found on server',
        code: 'RECEIPT_FILE_MISSING',
      })
    }

    const filename = `${donation.receipt_number.replace(/\//g, '-')}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.sendFile(fullPath)
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/donations/:id/send-whatsapp
router.post('/:id/send-whatsapp', async (req, res, next) => {
  try {
    const donation = await prisma.donation.findFirst({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
        is_deleted: false,
      },
    })

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found',
        code: 'NOT_FOUND',
      })
    }

    const receiptPath = await ensureReceiptAvailable(donation, req.trust)

    if (!receiptPath) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate receipt PDF before sending WhatsApp',
        code: 'RECEIPT_GENERATION_FAILED',
      })
    }

    const fullUrl = `${process.env.PUBLIC_URL || ''}${receiptPath}`

    const result = await sendReceiptWhatsApp(donation, req.trust, fullUrl)

    if (!result.sent && result.reason === 'not_configured') {
      return res.json({
        success: false,
        message: 'WhatsApp service is not configured',
      })
    }

    if (!result.sent) {
      await createNotification({
        trust_id: req.trustId,
        type: 'RECEIPT',
        title: 'WhatsApp Send Failed',
        message: `Failed to send WhatsApp for receipt ${donation.receipt_number}`,
        priority: 'MEDIUM',
      })
      return res.status(500).json({
        success: false,
        message: result.reason || 'Failed to send WhatsApp message',
      })
    }

    await prisma.donation.updateMany({
      where: {
        id: donation.id,
        trust_id: req.trustId,
      },
      data: {
        whatsapp_sent: true,
        whatsapp_sent_at: new Date(),
      },
    })

    logger.info('WhatsApp receipt sent', {
      receipt: donation.receipt_number,
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'DONATIONS',
      action: 'WHATSAPP_SEND',
      entity_type: 'Donation',
      entity_id: donation.id,
      description: `WhatsApp receipt sent for ${donation.receipt_number}`,
      metadata: { donor_mobile: donation.donor_mobile },
    })

    res.json({
      success: true,
      message: 'WhatsApp receipt sent successfully',
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/donations/:id/regenerate-receipt
router.post('/:id/regenerate-receipt', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        code: 'ADMIN_REQUIRED',
      })
    }

    const donation = await prisma.donation.findFirst({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
        is_deleted: false,
      },
    })

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found',
        code: 'NOT_FOUND',
      })
    }

    const receiptPath = await generateAndUploadReceipt(donation, req.trust)

    if (!receiptPath) {
      return res.status(500).json({
        success: false,
        message: 'Failed to regenerate receipt PDF',
        code: 'RECEIPT_GENERATION_FAILED',
      })
    }

    const receipt_url = `${process.env.PUBLIC_URL || ''}${receiptPath}`

    await createAuditLog({
      ...getAuditContext(req),
      module: 'DONATIONS',
      action: 'RECEIPT_REGENERATE',
      entity_type: 'Donation',
      entity_id: donation.id,
      description: `Receipt regenerated for ${donation.receipt_number}`,
    })

    res.json({
      success: true,
      message: 'Receipt regenerated successfully',
      receipt_url,
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/donations/:id/reconcile
router.post('/:id/reconcile', async (req, res, next) => {
  try {
    const donation = await prisma.donation.findFirst({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
        is_deleted: false,
      },
    })

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found',
        code: 'NOT_FOUND',
      })
    }

    if (donation.is_reconciled) {
      return res.status(400).json({
        success: false,
        message: 'Donation is already reconciled',
      })
    }

    await prisma.donation.updateMany({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
        is_deleted: false,
      },
      data: { is_reconciled: true },
    })

    await prisma.reconciliationLog.create({
      data: {
        trust_id: req.trustId,
        donation_id: donation.id,
        reconciled_by: req.user.id,
        remarks: req.body.remarks || null,
      },
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'DONATIONS',
      action: 'RECONCILE',
      entity_type: 'Donation',
      entity_id: donation.id,
      description: `Donation reconciled: ${donation.receipt_number}`,
      metadata: { amount: donation.amount },
    })

    res.json({
      success: true,
      message: 'Donation reconciled successfully',
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/donations/:id
router.get('/:id', async (req, res, next) => {
  try {
    const donation = await prisma.donation.findFirst({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
        is_deleted: false,
      },
    })

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found',
        code: 'NOT_FOUND',
      })
    }

    res.json({ success: true, donation })
  } catch (err) {
    next(err)
  }
})

// PUT /api/v1/donations/:id
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.donation.findFirst({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
        is_deleted: false,
      },
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found',
        code: 'NOT_FOUND',
      })
    }

    if (req.user.role !== 'ADMIN' && existing.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only admin or the creating user can edit this donation',
        code: 'FORBIDDEN',
      })
    }

    const {
      receipt_number: _rn,
      trust_id: _tid,
      id: _id,
      created_by: _cb,
      created_at: _ca,
      ...updateFields
    } = req.body

    const allowed = [
      'donor_name',
      'donor_mobile',
      'donor_city',
      'donor_email',
      'donor_address',
      'donor_state',
      'donor_pincode',
      'donor_type',
      'is_corpus',
      'amount',
      'payment_mode',
      'upi_ref',
      'cheque_number',
      'bank_ref',
      'purpose',
      'donation_date',
      'notes',
      'pan_number',
    ]
    const patch = {}
    allowed.forEach((field) => {
      if (updateFields[field] !== undefined) {
        patch[field] = updateFields[field]
      }
    })

    const validated = validateDonationUpdate(existing, patch)

    const auditNote = `[Edited by ${req.user.name} on ${new Date().toLocaleDateString('en-IN')}]`
    const mergedNotes = existing.notes ? `${existing.notes}\n${auditNote}` : auditNote

    const safeUpdate = {
      donor_name: validated.donor_name,
      donor_mobile: validated.donor_mobile,
      donor_city: validated.donor_city || null,
      donor_email: validated.donor_email || null,
      donor_address: validated.donor_address || null,
      donor_state: validated.donor_state || null,
      donor_pincode: validated.donor_pincode || null,
      donor_type: validated.donor_type || 'INDIVIDUAL',
      is_corpus: Boolean(validated.is_corpus),
      amount: validated.amount,
      payment_mode: validated.payment_mode,
      upi_ref: validated.upi_ref || null,
      cheque_number: validated.cheque_number || null,
      bank_ref: validated.bank_ref || null,
      purpose: validated.purpose,
      donation_date: new Date(validated.donation_date),
      notes: mergedNotes,
      pan_number: validated.pan_number || null,
    }

    const updateResult = await prisma.donation.updateMany({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
        is_deleted: false,
      },
      data: safeUpdate,
    })

    if (updateResult.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found',
        code: 'NOT_FOUND',
      })
    }

    const updated = await prisma.donation.findFirst({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
        is_deleted: false,
      },
    })

    logger.info('Donation updated', { id: req.params.id, by: req.user.username })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'DONATIONS',
      action: 'UPDATE',
      entity_type: 'Donation',
      entity_id: updated.id,
      description: `Donation updated: ${updated.receipt_number}`,
      metadata: { amount: updated.amount, donor: updated.donor_name },
    })

    res.json({
      success: true,
      message: 'Donation updated successfully',
      donation: updated,
    })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/v1/donations/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required to delete donations',
        code: 'ADMIN_REQUIRED',
      })
    }

    const existing = await prisma.donation.findFirst({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
        is_deleted: false,
      },
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found',
        code: 'NOT_FOUND',
      })
    }

    await prisma.donation.updateMany({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
        is_deleted: false,
      },
      data: { is_deleted: true },
    })

    logger.warn('Donation soft deleted', {
      id: req.params.id,
      receipt: existing.receipt_number,
      by: req.user.username,
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'DONATIONS',
      action: 'DELETE',
      entity_type: 'Donation',
      entity_id: existing.id,
      description: `Donation deleted: ${existing.receipt_number}`,
      metadata: { amount: existing.amount, donor: existing.donor_name },
    })

    res.json({
      success: true,
      message: 'Donation deleted successfully',
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
