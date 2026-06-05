const router = require('express').Router()
const bcrypt = require('bcryptjs')
const prisma = require('../../lib/prisma')
const {
  platformTrustSchema,
  platformUserSchema,
  platformUserPatchSchema,
  validate,
} = require('../../utils/validators')
const { createAuditLog } = require('../../services/audit.service')

function trustSummary(trust) {
  return {
    id: trust.id,
    slug: trust.slug,
    custom_domain: trust.custom_domain,
    name: trust.name,
    name_hindi: trust.name_hindi,
    address: trust.address,
    phone: trust.phone,
    email: trust.email,
    receipt_prefix: trust.receipt_prefix,
    current_fy: trust.current_fy,
    is_active: trust.is_active,
    primary_color: trust.primary_color,
    secondary_color: trust.secondary_color,
    created_at: trust.created_at,
    user_count: trust._count?.users ?? undefined,
  }
}

function userSummary(user) {
  return {
    id: user.id,
    trust_id: user.trust_id,
    name: user.name,
    username: user.username,
    role: user.role,
    is_active: user.is_active,
    is_platform_admin: user.is_platform_admin,
    last_login: user.last_login,
    created_at: user.created_at,
  }
}

// GET /api/v1/platform/trusts
router.get('/trusts', async (req, res, next) => {
  try {
    const trusts = await prisma.trust.findMany({
      orderBy: { created_at: 'desc' },
      include: { _count: { select: { users: true } } },
    })
    res.json({
      success: true,
      trusts: trusts.map(trustSummary),
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/platform/trusts — onboard new trust + first admin
router.post('/trusts', async (req, res, next) => {
  try {
    const data = validate(platformTrustSchema, req.body)

    const existingPrefix = await prisma.trust.findFirst({
      where: { receipt_prefix: data.receipt_prefix },
    })
    if (existingPrefix) {
      return res.status(409).json({
        success: false,
        message: 'Receipt prefix is already used by another trust',
        code: 'RECEIPT_PREFIX_TAKEN',
      })
    }

    const existingSlug = await prisma.trust.findFirst({
      where: { slug: data.slug },
    })
    if (existingSlug) {
      return res.status(409).json({
        success: false,
        message: 'Subdomain slug is already taken',
        code: 'SLUG_TAKEN',
      })
    }

    const passwordHash = await bcrypt.hash(data.admin_password, 12)

    const result = await prisma.$transaction(async (tx) => {
      const trust = await tx.trust.create({
        data: {
          slug: data.slug,
          name: data.name,
          name_hindi: data.name_hindi,
          address: data.address,
          phone: data.phone,
          email: data.email || null,
          receipt_prefix: data.receipt_prefix,
          current_fy: data.current_fy || '2025-26',
          primary_color: data.primary_color || '#FF6B00',
          secondary_color: data.secondary_color || '#7B1C1C',
        },
      })

      const adminUser = await tx.user.create({
        data: {
          trust_id: trust.id,
          name: data.admin_name,
          username: data.admin_username,
          password_hash: passwordHash,
          role: 'ADMIN',
        },
      })

      return { trust, adminUser }
    })

    await createAuditLog({
      trust_id: result.trust.id,
      user_id: req.platformAdmin.id,
      module: 'PLATFORM',
      action: 'CREATE',
      entity_type: 'Trust',
      entity_id: result.trust.id,
      description: `Platform onboarded trust: ${result.trust.name}`,
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    })

    res.status(201).json({
      success: true,
      message: 'Trust onboarded successfully',
      trust: trustSummary({ ...result.trust, _count: { users: 1 } }),
      admin_user: userSummary(result.adminUser),
    })
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Username already exists for this trust',
        code: 'USERNAME_TAKEN',
      })
    }
    next(err)
  }
})

// GET /api/v1/platform/trusts/:trustId/users
router.get('/trusts/:trustId/users', async (req, res, next) => {
  try {
    const { trustId } = req.params
    const trust = await prisma.trust.findUnique({
      where: { id: trustId },
      include: {
        users: { orderBy: { created_at: 'asc' } },
      },
    })

    if (!trust) {
      return res.status(404).json({ success: false, message: 'Trust not found', code: 'NOT_FOUND' })
    }

    res.json({
      success: true,
      trust: trustSummary({ ...trust, _count: { users: trust.users.length } }),
      users: trust.users.map(userSummary),
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/platform/trusts/:trustId/users
router.post('/trusts/:trustId/users', async (req, res, next) => {
  try {
    const { trustId } = req.params
    const data = validate(platformUserSchema, req.body)

    const trust = await prisma.trust.findUnique({ where: { id: trustId } })
    if (!trust) {
      return res.status(404).json({ success: false, message: 'Trust not found', code: 'NOT_FOUND' })
    }

    const passwordHash = await bcrypt.hash(data.password, 12)

    const user = await prisma.user.create({
      data: {
        trust_id: trustId,
        name: data.name,
        username: data.username,
        password_hash: passwordHash,
        role: data.role,
      },
    })

    await createAuditLog({
      trust_id: trustId,
      user_id: req.platformAdmin.id,
      module: 'PLATFORM',
      action: 'CREATE',
      entity_type: 'User',
      entity_id: user.id,
      description: `Platform created user ${user.username} (${user.role})`,
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    })

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: userSummary(user),
    })
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Username already exists for this trust',
        code: 'USERNAME_TAKEN',
      })
    }
    next(err)
  }
})

// PATCH /api/v1/platform/users/:userId
router.patch('/users/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params
    const data = validate(platformUserPatchSchema, req.body)

    const existing = await prisma.user.findUnique({ where: { id: userId } })
    if (!existing) {
      return res.status(404).json({ success: false, message: 'User not found', code: 'NOT_FOUND' })
    }

    if (existing.is_platform_admin && data.is_active === false) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate a platform administrator from this screen',
        code: 'CANNOT_DEACTIVATE_PLATFORM_ADMIN',
      })
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
      },
    })

    await createAuditLog({
      trust_id: user.trust_id,
      user_id: req.platformAdmin.id,
      module: 'PLATFORM',
      action: 'UPDATE',
      entity_type: 'User',
      entity_id: user.id,
      description: `Platform updated user ${user.username}`,
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    })

    res.json({ success: true, user: userSummary(user) })
  } catch (err) {
    next(err)
  }
})

module.exports = router
