const router = require('express').Router()
const bcrypt = require('bcryptjs')
const prisma = require('../../lib/prisma')
const {
  trustUserSchema,
  trustUserPatchSchema,
  trustUserPasswordSchema,
  validate,
} = require('../../utils/validators')
const { createAuditLog } = require('../../services/audit.service')
const { getAuditContext } = require('../../utils/auditContext')
const { buildTenantLoginUrl } = require('../../utils/tenantHost')

function userSummary(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    is_active: user.is_active,
    last_login: user.last_login,
    created_at: user.created_at,
  }
}

// GET /api/v1/users
router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { trust_id: req.trustId },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        is_active: true,
        is_platform_admin: true,
        last_login: true,
        created_at: true,
      },
    })

    res.json({
      success: true,
      users: users.map((u) => ({
        ...userSummary(u),
        is_platform_admin: Boolean(u.is_platform_admin),
        is_self: u.id === req.user.id,
      })),
      login_url: buildTenantLoginUrl(req.trust.slug),
      slug: req.trust.slug,
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/users
router.post('/', async (req, res, next) => {
  try {
    const data = validate(trustUserSchema, req.body)
    const passwordHash = await bcrypt.hash(data.password, 12)

    const user = await prisma.user.create({
      data: {
        trust_id: req.trustId,
        name: data.name,
        username: data.username,
        password_hash: passwordHash,
        role: data.role,
      },
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'SETTINGS',
      action: 'CREATE',
      entity_type: 'User',
      entity_id: user.id,
      description: `Trust admin created user ${user.username} (${user.role})`,
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

// PATCH /api/v1/users/:userId
router.patch('/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params
    const data = validate(trustUserPatchSchema, req.body)

    const existing = await prisma.user.findFirst({
      where: { id: userId, trust_id: req.trustId },
    })

    if (!existing) {
      return res.status(404).json({ success: false, message: 'User not found', code: 'NOT_FOUND' })
    }

    if (existing.is_platform_admin) {
      return res.status(400).json({
        success: false,
        message: 'Platform administrator accounts cannot be changed here',
        code: 'PLATFORM_USER_PROTECTED',
      })
    }

    if (userId === req.user.id && data.is_active === false) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account',
        code: 'CANNOT_DEACTIVATE_SELF',
      })
    }

    if (userId === req.user.id && data.role && data.role !== req.user.role) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own role',
        code: 'CANNOT_CHANGE_OWN_ROLE',
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
      ...getAuditContext(req),
      module: 'SETTINGS',
      action: 'UPDATE',
      entity_type: 'User',
      entity_id: user.id,
      description: `Trust admin updated user ${user.username}`,
      metadata: data,
    })

    res.json({ success: true, user: userSummary(user) })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/users/:userId/reset-password
router.post('/:userId/reset-password', async (req, res, next) => {
  try {
    const { userId } = req.params
    const { new_password } = validate(trustUserPasswordSchema, req.body)

    const existing = await prisma.user.findFirst({
      where: { id: userId, trust_id: req.trustId },
    })

    if (!existing) {
      return res.status(404).json({ success: false, message: 'User not found', code: 'NOT_FOUND' })
    }

    if (existing.is_platform_admin && existing.id !== req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reset password for platform administrator',
        code: 'PLATFORM_USER_PROTECTED',
      })
    }

    const passwordHash = await bcrypt.hash(new_password, 12)
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: passwordHash },
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'SETTINGS',
      action: 'UPDATE',
      entity_type: 'User',
      entity_id: userId,
      description: `Password reset for user ${existing.username}`,
    })

    res.json({ success: true, message: 'Password updated successfully' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
