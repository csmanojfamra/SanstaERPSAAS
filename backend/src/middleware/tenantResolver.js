const prisma = require('../lib/prisma')

module.exports = async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.jwtUser.id, trust_id: req.jwtUser.trust_id },
      include: { trust: true },
    })

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      })
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'User account is inactive',
        code: 'USER_INACTIVE',
      })
    }

    if (!user.trust.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Trust account is inactive',
        code: 'TRUST_INACTIVE',
      })
    }

    const { password_hash, ...safeUser } = user
    req.user = safeUser
    req.trustId = user.trust_id
    req.trust = user.trust

    // Update last login timestamp — fire and forget
    prisma.user
      .updateMany({
        where: { id: user.id, trust_id: user.trust_id },
        data: { last_login: new Date() },
      })
      .catch(() => {})

    next()
  } catch (err) {
    next(err)
  }
}

