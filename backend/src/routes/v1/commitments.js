const router = require('express').Router()
const { z } = require('zod')
const prisma = require('../../lib/prisma')
const { validate, parseQueryDateParam } = require('../../utils/validators')
const { createAuditLog } = require('../../services/audit.service')
const { getAuditContext } = require('../../utils/auditContext')
const { generateReceiptNumber } = require('../../services/receiptNumber.service')
const { generateReceiptBuffer } = require('../../services/receipt.service')
const { saveReceiptPDF } = require('../../services/storage.service')

const LIFETIME_CODE = 'LIFETIME'

const planSchema = z.object({
  total_amount: z.coerce.number().positive().max(99_999_999.99),
  tenure_months: z.coerce.number().int().min(1).max(120),
  title: z.string().min(2).max(120).optional(),
  is_active: z.boolean().optional(),
})

const enrollSchema = z.object({
  name: z.string().min(2).max(200),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  city: z.string().max(100).optional().or(z.literal('')),
  start_date: z.string().min(1),
  notes: z.string().max(500).optional().or(z.literal('')),
  plan_code: z.string().default(LIFETIME_CODE),
})

const paymentSchema = z.object({
  amount: z.coerce.number().positive().max(99_999_999.99),
  payment_date: z.string().min(1),
  payment_mode: z.enum(['CASH', 'UPI', 'CHEQUE', 'NEFT', 'RTGS', 'DD', 'ONLINE']),
  upi_ref: z.string().max(100).optional().or(z.literal('')),
  cheque_number: z.string().max(50).optional().or(z.literal('')),
  bank_ref: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
})

function memberSummary(member, plan) {
  const paid = (member.installments || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const committed = Number(plan?.total_amount || member.plan?.total_amount || 0)
  const pending = Math.max(0, committed - paid)
  const tenureMonths = plan?.tenure_months || member.plan?.tenure_months || 0
  const start = new Date(member.start_date)
  const dueEnd = new Date(start)
  dueEnd.setMonth(dueEnd.getMonth() + tenureMonths)
  return {
    ...member,
    amount_committed: committed,
    amount_paid: paid,
    amount_pending: pending,
    percent_paid: committed > 0 ? Math.min(100, Math.round((paid / committed) * 1000) / 10) : 0,
    tenure_end_date: dueEnd.toISOString().slice(0, 10),
    is_overdue: member.status === 'ACTIVE' && pending > 0 && dueEnd < new Date(),
  }
}

async function ensureLifetimePlan(trustId, defaults = {}) {
  const existing = await prisma.commitmentPlan.findUnique({
    where: { trust_id_code: { trust_id: trustId, code: LIFETIME_CODE } },
  })
  if (existing) return existing
  return prisma.commitmentPlan.create({
    data: {
      trust_id: trustId,
      code: LIFETIME_CODE,
      title: defaults.title || 'Lifetime Membership',
      total_amount: defaults.total_amount || 110000,
      tenure_months: defaults.tenure_months || 36,
      is_active: true,
    },
  })
}

// GET /api/v1/commitments/plans/lifetime
router.get('/plans/lifetime', async (req, res, next) => {
  try {
    const plan = await ensureLifetimePlan(req.trustId)
    res.json({ success: true, plan })
  } catch (err) {
    next(err)
  }
})

// PUT /api/v1/commitments/plans/lifetime
router.put('/plans/lifetime', async (req, res, next) => {
  try {
    const data = validate(planSchema, req.body)
    const plan = await prisma.commitmentPlan.upsert({
      where: { trust_id_code: { trust_id: req.trustId, code: LIFETIME_CODE } },
      create: {
        trust_id: req.trustId,
        code: LIFETIME_CODE,
        title: data.title || 'Lifetime Membership',
        total_amount: data.total_amount,
        tenure_months: data.tenure_months,
        is_active: data.is_active ?? true,
      },
      update: {
        title: data.title || 'Lifetime Membership',
        total_amount: data.total_amount,
        tenure_months: data.tenure_months,
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
      },
    })

    const trust = await prisma.trust.findFirst({
      where: { id: req.trustId },
      select: { settings_json: true },
    })
    const currentJson = trust?.settings_json && typeof trust.settings_json === 'object' ? trust.settings_json : {}
    await prisma.trust.updateMany({
      where: { id: req.trustId },
      data: {
        settings_json: {
          ...currentJson,
          membership: {
            ...(currentJson.membership || {}),
            enabled: data.is_active !== false,
            lifetime: {
              ...((currentJson.membership && currentJson.membership.lifetime) || {}),
              title: plan.title,
              amount: Number(plan.total_amount),
              tenure_months: plan.tenure_months,
            },
          },
        },
      },
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'MEMBERSHIP',
      action: 'UPDATE',
      entity_type: 'CommitmentPlan',
      entity_id: plan.id,
      description: `Lifetime plan set to ₹${Number(plan.total_amount)} / ${plan.tenure_months} months`,
    })

    res.json({ success: true, plan })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/commitments/members
router.get('/members', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25))
    const skip = (page - 1) * limit
    const search = (req.query.search || '').trim()
    const status = (req.query.status || '').toUpperCase()

    const where = {
      trust_id: req.trustId,
      ...(status && ['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status) ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { mobile: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [total, members] = await Promise.all([
      prisma.commitmentMember.count({ where }),
      prisma.commitmentMember.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ created_at: 'desc' }],
        include: {
          plan: true,
          installments: { select: { amount: true } },
        },
      }),
    ])

    res.json({
      success: true,
      members: members.map((m) => memberSummary(m, m.plan)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/commitments/members/:id
router.get('/members/:id', async (req, res, next) => {
  try {
    const member = await prisma.commitmentMember.findFirst({
      where: { id: req.params.id, trust_id: req.trustId },
      include: {
        plan: true,
        installments: {
          orderBy: { payment_date: 'desc' },
          include: {
            donation: {
              select: {
                id: true,
                receipt_number: true,
                amount: true,
                payment_mode: true,
                donation_date: true,
              },
            },
          },
        },
      },
    })
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' })
    }
    res.json({ success: true, member: memberSummary(member, member.plan) })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/commitments/members
router.post('/members', async (req, res, next) => {
  try {
    const data = validate(enrollSchema, req.body)
    const startDate = parseQueryDateParam(data.start_date, 'start_date')
    if (!startDate) {
      return res.status(400).json({ success: false, message: 'Valid start_date is required' })
    }

    const plan = await ensureLifetimePlan(req.trustId)
    if (!plan.is_active) {
      return res.status(400).json({ success: false, message: 'Lifetime membership plan is inactive' })
    }

    const member = await prisma.commitmentMember.create({
      data: {
        trust_id: req.trustId,
        plan_id: plan.id,
        name: data.name.trim(),
        mobile: data.mobile,
        city: data.city || null,
        start_date: startDate,
        notes: data.notes || null,
        status: 'ACTIVE',
      },
      include: { plan: true, installments: true },
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'MEMBERSHIP',
      action: 'CREATE',
      entity_type: 'CommitmentMember',
      entity_id: member.id,
      description: `Lifetime member enrolled: ${member.name}`,
    })

    res.status(201).json({ success: true, member: memberSummary(member, member.plan) })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/v1/commitments/members/:id/status
router.patch('/members/:id/status', async (req, res, next) => {
  try {
    const status = String(req.body.status || '').toUpperCase()
    if (!['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' })
    }
    const existing = await prisma.commitmentMember.findFirst({
      where: { id: req.params.id, trust_id: req.trustId },
    })
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Member not found' })
    }
    const member = await prisma.commitmentMember.update({
      where: { id: existing.id },
      data: { status },
      include: { plan: true, installments: true },
    })
    res.json({ success: true, member: memberSummary(member, member.plan) })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/commitments/members/:id/payments
router.post('/members/:id/payments', async (req, res, next) => {
  try {
    const data = validate(paymentSchema, req.body)
    const paymentDate = parseQueryDateParam(data.payment_date, 'payment_date')
    if (!paymentDate) {
      return res.status(400).json({ success: false, message: 'Valid payment_date is required' })
    }

    const member = await prisma.commitmentMember.findFirst({
      where: { id: req.params.id, trust_id: req.trustId },
      include: { plan: true, installments: true },
    })
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' })
    }
    if (member.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot record payment for cancelled member' })
    }

    const summary = memberSummary(member, member.plan)
    if (Number(data.amount) > summary.amount_pending + 0.009) {
      return res.status(400).json({
        success: false,
        message: `Payment exceeds pending balance (₹${summary.amount_pending.toLocaleString('en-IN')})`,
        code: 'EXCEEDS_PENDING',
        pending: summary.amount_pending,
      })
    }

    const result = await prisma.$transaction(async (tx) => {
      const receipt_number = await generateReceiptNumber(req.trustId, tx)
      const donation = await tx.donation.create({
        data: {
          trust_id: req.trustId,
          receipt_number,
          donor_name: member.name,
          donor_mobile: member.mobile,
          donor_city: member.city || null,
          amount: data.amount,
          payment_mode: data.payment_mode,
          upi_ref: data.upi_ref || null,
          cheque_number: data.cheque_number || null,
          bank_ref: data.bank_ref || null,
          purpose: `${member.plan.title} installment`,
          donation_date: paymentDate,
          notes: data.notes || `Commitment payment for ${member.name}`,
          created_by: req.user?.id || null,
        },
      })

      const installment = await tx.commitmentInstallment.create({
        data: {
          member_id: member.id,
          amount: data.amount,
          payment_date: paymentDate,
          donation_id: donation.id,
          notes: data.notes || null,
        },
      })

      const paidAfter = summary.amount_paid + Number(data.amount)
      const completed = paidAfter >= Number(member.plan.total_amount) - 0.009
      if (completed && member.status !== 'COMPLETED') {
        await tx.commitmentMember.update({
          where: { id: member.id },
          data: { status: 'COMPLETED' },
        })
      }

      return { donation, installment, completed }
    })

    try {
      const pdfBuffer = await generateReceiptBuffer(result.donation, req.trust)
      const { url } = saveReceiptPDF(result.donation.receipt_number, pdfBuffer)
      await prisma.donation.updateMany({
        where: { id: result.donation.id, trust_id: req.trustId },
        data: { receipt_pdf_path: url, receipt_sent_at: new Date() },
      })
    } catch {
      // Receipt PDF failure should not roll back payment
    }

    await createAuditLog({
      ...getAuditContext(req),
      module: 'MEMBERSHIP',
      action: 'PAYMENT',
      entity_type: 'CommitmentMember',
      entity_id: member.id,
      description: `Membership payment ₹${Number(data.amount)} — ${result.donation.receipt_number}`,
      metadata: { donation_id: result.donation.id, amount: data.amount },
    })

    const refreshed = await prisma.commitmentMember.findFirst({
      where: { id: member.id },
      include: { plan: true, installments: { include: { donation: true }, orderBy: { payment_date: 'desc' } } },
    })

    res.status(201).json({
      success: true,
      donation: result.donation,
      installment: result.installment,
      member: memberSummary(refreshed, refreshed.plan),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/commitments/summary
router.get('/summary', async (req, res, next) => {
  try {
    const plan = await ensureLifetimePlan(req.trustId)
    const members = await prisma.commitmentMember.findMany({
      where: { trust_id: req.trustId, plan_id: plan.id },
      include: { plan: true, installments: { select: { amount: true } } },
    })
    const enriched = members.map((m) => memberSummary(m, m.plan))
    const active = enriched.filter((m) => m.status === 'ACTIVE')
    const completed = enriched.filter((m) => m.status === 'COMPLETED')
    const overdue = enriched.filter((m) => m.is_overdue)

    const committed = enriched.reduce((s, m) => s + m.amount_committed, 0)
    const collected = enriched.reduce((s, m) => s + m.amount_paid, 0)
    const pending = enriched.reduce((s, m) => s + m.amount_pending, 0)

    res.json({
      success: true,
      plan,
      summary: {
        members_total: enriched.length,
        members_active: active.length,
        members_completed: completed.length,
        members_overdue: overdue.length,
        amount_committed: committed,
        amount_collected: collected,
        amount_pending: pending,
      },
      overdue_members: overdue.slice(0, 20),
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
module.exports.ensureLifetimePlan = ensureLifetimePlan
module.exports.LIFETIME_CODE = LIFETIME_CODE
