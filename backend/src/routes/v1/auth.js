const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../../lib/prisma')
const authMiddleware = require('../../middleware/auth')
const tenantResolver = require('../../middleware/tenantResolver')
const { loginLimiter } = require('../../middleware/rateLimiter')
const { loginSchema, validate } = require('../../utils/validators')
const { createAuditLog } = require('../../services/audit.service')
const { createNotification } = require('../../services/notification.service')
const { resolveTrustFromRequest } = require('../../services/tenant.service')

// POST /api/v1/auth/login
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = validate(loginSchema, req.body)
    const tenantResolution = await resolveTrustFromRequest(req)

    if (tenantResolution.error === 'TRUST_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Trust not found for this login URL',
        code: 'TRUST_NOT_FOUND',
      })
    }

    let user

    if (tenantResolution.trust) {
      user = await prisma.user.findFirst({
        where: {
          username,
          trust_id: tenantResolution.trust.id,
          is_active: true,
          trust: { is_active: true },
        },
        include: { trust: true },
      })
    } else {
      const matches = await prisma.user.findMany({
        where: {
          username,
          is_active: true,
          trust: { is_active: true },
        },
        include: { trust: true },
      })

      if (matches.length > 1) {
        return res.status(400).json({
          success: false,
          message:
            'Multiple trusts use this username. Use a unique username or add ?tenant=your-slug to the login URL.',
          code: 'TENANT_REQUIRED',
        })
      }

      user = matches[0] || null
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
        code: 'INVALID_CREDENTIALS',
      })
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
        code: 'INVALID_CREDENTIALS',
      })
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        trust_id: user.trust_id,
        role: user.role,
        is_platform_admin: Boolean(user.is_platform_admin),
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    )

    const clientIp = req.ip || req.socket?.remoteAddress || null
    const userAgent = req.headers['user-agent'] || null

    const previousLogin = await prisma.auditLog.findFirst({
      where: {
        trust_id: user.trust_id,
        user_id: user.id,
        module: 'SECURITY',
        action: 'LOGIN',
      },
      orderBy: { created_at: 'desc' },
    })

    if (previousLogin && previousLogin.ip_address && clientIp && previousLogin.ip_address !== clientIp) {
      await createNotification({
        trust_id: user.trust_id,
        type: 'SECURITY',
        title: 'Login from New IP',
        message: `User ${user.username} logged in from a new IP address (${clientIp})`,
        priority: 'CRITICAL',
      })
    }

    await createAuditLog({
      trust_id: user.trust_id,
      user_id: user.id,
      module: 'SECURITY',
      action: 'LOGIN',
      entity_type: 'User',
      entity_id: user.id,
      description: `User logged in: ${user.username}`,
      ip_address: clientIp,
      user_agent: userAgent,
    })

    await prisma.user.updateMany({
      where: { id: user.id, trust_id: user.trust_id },
      data: { last_login: new Date() },
    })

    const { password_hash, ...safeUser } = user
    const { password_hash: _th, ...safeTrust } = user.trust

    res.json({
      success: true,
      token,
      user: {
        id: safeUser.id,
        name: safeUser.name,
        username: safeUser.username,
        role: safeUser.role,
        is_platform_admin: Boolean(safeUser.is_platform_admin),
      },
      trust: {
        id: safeTrust.id,
        slug: safeTrust.slug,
        name_hindi: safeTrust.name_hindi,
        name: safeTrust.name,
        receipt_prefix: safeTrust.receipt_prefix,
        primary_color: safeTrust.primary_color,
        secondary_color: safeTrust.secondary_color,
        donor_threshold: safeTrust.donor_threshold,
        top_donors_limit: safeTrust.top_donors_limit,
        opening_cash_balance: Number(safeTrust.opening_cash_balance || 0),
        opening_bank_balance: Number(safeTrust.opening_bank_balance || 0),
      },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/auth/change-password
router.post('/change-password', authMiddleware, tenantResolver, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      })
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/
    if (!passwordRegex.test(new_password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters with one uppercase letter and one number',
      })
    }

    const user = await prisma.user.findFirst({
      where: { id: req.user.id, trust_id: req.trustId },
    })

    const match = await bcrypt.compare(current_password, user.password_hash)
    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      })
    }

    const newHash = await bcrypt.hash(new_password, 12)
    await prisma.user.updateMany({
      where: { id: req.user.id, trust_id: req.trustId },
      data: { password_hash: newHash },
    })

    res.json({ success: true, message: 'Password changed successfully' })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/auth/me
router.get('/me', authMiddleware, tenantResolver, (req, res) => {
  res.json({ success: true, user: req.user, trust: req.trust })
})

module.exports = router

