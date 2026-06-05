const router = require('express').Router()
const prisma = require('../../lib/prisma')
const { trusteeSchema, contributionSchema, validate } = require('../../utils/validators')
const logger = require('../../utils/logger')
const { createAuditLog } = require('../../services/audit.service')
const { getAuditContext } = require('../../utils/auditContext')

async function findTrusteeForTrust(trustId, trusteeId, activeOnly = true) {
  return prisma.trustee.findFirst({
    where: {
      id: trusteeId,
      trust_id: trustId,
      ...(activeOnly ? { is_active: true } : {}),
    },
  })
}

function trusteeJoiningDate(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function buildAddressSummary(data) {
  const parts = [data.address_line1, data.address_line2, data.city, data.state, data.pincode]
    .map((x) => (x || '').trim())
    .filter(Boolean)
  if (parts.length) return parts.join(', ')
  return data.address || null
}

// GET /api/v1/trustees
router.get('/', async (req, res, next) => {
  try {
    const trustees = await prisma.trustee.findMany({
      where: {
        trust_id: req.trustId,
        is_active: true,
      },
      orderBy: [{ display_order: 'asc' }, { name: 'asc' }],
    })

    const grouped = await prisma.trusteeContribution.groupBy({
      by: ['trustee_id'],
      where: {
        trustee: {
          trust_id: req.trustId,
        },
      },
      _sum: { amount: true },
      _count: { id: true },
      _max: { contribution_date: true },
    })

    const summaryMap = Object.fromEntries(
      grouped.map((g) => [
        g.trustee_id,
        {
          total_contributions: g._sum.amount || 0,
          contribution_count: g._count.id || 0,
          last_contribution_date: g._max.contribution_date || null,
        },
      ])
    )

    const enriched = trustees.map((t) => ({
      ...t,
      total_contributions: summaryMap[t.id]?.total_contributions || 0,
      contribution_count: summaryMap[t.id]?.contribution_count || 0,
      last_contribution_date: summaryMap[t.id]?.last_contribution_date || null,
    }))

    res.json({ success: true, trustees: enriched })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/trustees
router.post('/', async (req, res, next) => {
  try {
    const data = validate(trusteeSchema, req.body)
    const addressSummary = buildAddressSummary(data)

    const trustee = await prisma.trustee.create({
      data: {
        trust_id: req.trustId,
        name: data.name,
        name_hindi: data.name_hindi || null,
        mobile: data.mobile || null,
        email: data.email || null,
        role: data.role || 'Trustee',
        joining_date: data.joining_date ? new Date(data.joining_date) : null,
        pan_number: data.pan_number || null,
        address: addressSummary,
        address_line1: data.address_line1 || null,
        address_line2: data.address_line2 || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
        notes: data.notes || null,
        authorized_signatory: Boolean(data.authorized_signatory),
        bank_signatory: Boolean(data.bank_signatory),
        is_active: data.is_active !== false,
        display_order: data.display_order ?? 0,
      },
    })

    logger.info('Trustee created', { id: trustee.id, trust: req.trustId })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'TRUSTEES',
      action: 'CREATE',
      entity_type: 'Trustee',
      entity_id: trustee.id,
      description: `Trustee created: ${trustee.name}`,
    })

    res.status(201).json({
      success: true,
      message: 'Trustee created successfully',
      trustee,
    })
  } catch (err) {
    next(err)
  }
})

// PUT /api/v1/trustees/:id
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await findTrusteeForTrust(req.trustId, req.params.id)

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Trustee not found',
        code: 'NOT_FOUND',
      })
    }

    const data = validate(trusteeSchema, {
      name: existing.name,
      name_hindi: existing.name_hindi || '',
      mobile: existing.mobile || '',
      email: existing.email || '',
      role: existing.role || 'Trustee',
      joining_date: trusteeJoiningDate(existing.joining_date),
      pan_number: existing.pan_number || '',
      address: existing.address || '',
      address_line1: existing.address_line1 || '',
      address_line2: existing.address_line2 || '',
      city: existing.city || '',
      state: existing.state || '',
      pincode: existing.pincode || '',
      notes: existing.notes || '',
      authorized_signatory: Boolean(existing.authorized_signatory),
      bank_signatory: Boolean(existing.bank_signatory),
      is_active: existing.is_active !== false,
      display_order: existing.display_order ?? 0,
      ...req.body,
      joining_date:
        req.body.joining_date !== undefined
          ? req.body.joining_date
          : trusteeJoiningDate(existing.joining_date),
    })
    const addressSummary = buildAddressSummary(data)

    const updateResult = await prisma.trustee.updateMany({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
        is_active: true,
      },
      data: {
        name: data.name,
        name_hindi: data.name_hindi || null,
        mobile: data.mobile || null,
        email: data.email || null,
        role: data.role || 'Trustee',
        joining_date: data.joining_date ? new Date(data.joining_date) : null,
        pan_number: data.pan_number || null,
        address: addressSummary,
        address_line1: data.address_line1 || null,
        address_line2: data.address_line2 || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
        notes: data.notes || null,
        authorized_signatory: Boolean(data.authorized_signatory),
        bank_signatory: Boolean(data.bank_signatory),
        is_active: data.is_active !== false,
        display_order: data.display_order ?? 0,
      },
    })

    if (updateResult.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Trustee not found',
        code: 'NOT_FOUND',
      })
    }

    const trustee = await prisma.trustee.findFirst({
      where: { id: req.params.id, trust_id: req.trustId },
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'TRUSTEES',
      action: 'UPDATE',
      entity_type: 'Trustee',
      entity_id: trustee.id,
      description: `Trustee updated: ${trustee.name}`,
    })

    res.json({
      success: true,
      message: 'Trustee updated successfully',
      trustee,
    })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/v1/trustees/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        code: 'ADMIN_REQUIRED',
      })
    }

    const existing = await findTrusteeForTrust(req.trustId, req.params.id)

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Trustee not found',
        code: 'NOT_FOUND',
      })
    }

    const count = await prisma.trusteeContribution.count({
      where: {
        trustee_id: req.params.id,
        trustee: { trust_id: req.trustId },
      },
    })

    if (count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete trustee with contribution records',
      })
    }

    await prisma.trustee.updateMany({
      where: {
        id: req.params.id,
        trust_id: req.trustId,
      },
      data: { is_active: false },
    })

    logger.info('Trustee soft deleted', { id: req.params.id, trust: req.trustId })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'TRUSTEES',
      action: 'DELETE',
      entity_type: 'Trustee',
      entity_id: existing.id,
      description: `Trustee deleted: ${existing.name}`,
    })

    res.json({
      success: true,
      message: 'Trustee deleted successfully',
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/trustees/:id/contributions
router.get('/:id/contributions', async (req, res, next) => {
  try {
    const trustee = await findTrusteeForTrust(req.trustId, req.params.id)

    if (!trustee) {
      return res.status(404).json({
        success: false,
        message: 'Trustee not found',
        code: 'NOT_FOUND',
      })
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25))
    const skip = (page - 1) * limit

    const where = {
      trustee_id: req.params.id,
      trustee: { trust_id: req.trustId },
    }

    const [total, contributions, aggregate] = await prisma.$transaction([
      prisma.trusteeContribution.count({ where }),
      prisma.trusteeContribution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { contribution_date: 'desc' },
      }),
      prisma.trusteeContribution.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ])

    const totalPages = Math.ceil(total / limit)

    res.json({
      success: true,
      contributions,
      summary: {
        total_amount: aggregate._sum.amount || 0,
        contribution_count: aggregate._count.id || 0,
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

// POST /api/v1/trustees/:id/contributions
router.post('/:id/contributions', async (req, res, next) => {
  try {
    const trustee = await findTrusteeForTrust(req.trustId, req.params.id)

    if (!trustee) {
      return res.status(404).json({
        success: false,
        message: 'Trustee not found',
        code: 'NOT_FOUND',
      })
    }

    const body = { ...req.body, amount: parseFloat(req.body.amount) }
    const data = validate(contributionSchema, body)

    const contribution = await prisma.trusteeContribution.create({
      data: {
        trustee_id: req.params.id,
        amount: data.amount,
        contribution_date: new Date(data.contribution_date),
        payment_mode: data.payment_mode || null,
        remarks: data.remarks || null,
      },
    })

    logger.info('Trustee contribution recorded', {
      trustee_id: req.params.id,
      amount: data.amount,
      trust: req.trustId,
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'TRUSTEES',
      action: 'CREATE',
      entity_type: 'TrusteeContribution',
      entity_id: contribution.id,
      description: `Contribution recorded for ${trustee.name}: ₹${data.amount}`,
      metadata: { trustee_id: trustee.id, amount: data.amount },
    })

    res.status(201).json({
      success: true,
      message: 'Contribution recorded successfully',
      contribution,
    })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/v1/trustees/:trusteeId/contributions/:contributionId
router.delete('/:trusteeId/contributions/:contributionId', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        code: 'ADMIN_REQUIRED',
      })
    }

    const contribution = await prisma.trusteeContribution.findFirst({
      where: {
        id: req.params.contributionId,
        trustee_id: req.params.trusteeId,
        trustee: { trust_id: req.trustId },
      },
    })

    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: 'Contribution not found',
        code: 'NOT_FOUND',
      })
    }

    await prisma.trusteeContribution.delete({
      where: { id: req.params.contributionId },
    })

    logger.info('Trustee contribution deleted', {
      id: req.params.contributionId,
      trustee_id: req.params.trusteeId,
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'TRUSTEES',
      action: 'DELETE',
      entity_type: 'TrusteeContribution',
      entity_id: contribution.id,
      description: `Trustee contribution deleted (${req.params.contributionId})`,
    })

    res.json({
      success: true,
      message: 'Contribution deleted successfully',
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
