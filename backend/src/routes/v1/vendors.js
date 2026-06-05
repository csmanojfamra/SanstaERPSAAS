const router = require('express').Router()
const prisma = require('../../lib/prisma')
const { vendorSchema, validate } = require('../../utils/validators')
const { createAuditLog } = require('../../services/audit.service')
const { getAuditContext } = require('../../utils/auditContext')

// GET /api/v1/vendors
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.search || '').trim()
    const includeInactive = String(req.query.include_inactive || '').toLowerCase() === 'true'
    const vendors = await prisma.vendor.findMany({
      where: {
        trust_id: req.trustId,
        ...(includeInactive ? {} : { is_active: true }),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { mobile: { contains: q, mode: 'insensitive' } },
                { category: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ name: 'asc' }],
      take: 200,
    })
    res.json({ success: true, vendors })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/vendors
router.post('/', async (req, res, next) => {
  try {
    const data = validate(vendorSchema, req.body || {})
    const vendor = await prisma.vendor.upsert({
      where: {
        trust_id_name_mobile: {
          trust_id: req.trustId,
          name: data.name.trim(),
          mobile: data.mobile || null,
        },
      },
      update: {
        category: data.category || 'GENERAL',
        notes: data.notes || null,
        is_active: data.is_active ?? true,
      },
      create: {
        trust_id: req.trustId,
        name: data.name.trim(),
        mobile: data.mobile || null,
        category: data.category || 'GENERAL',
        notes: data.notes || null,
        is_active: data.is_active ?? true,
      },
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'VENDORS',
      action: 'CREATE',
      entity_type: 'Vendor',
      entity_id: vendor.id,
      description: `Vendor saved: ${vendor.name}`,
      metadata: { mobile: vendor.mobile, category: vendor.category },
    })

    res.status(201).json({ success: true, vendor })
  } catch (err) {
    next(err)
  }
})

module.exports = router
