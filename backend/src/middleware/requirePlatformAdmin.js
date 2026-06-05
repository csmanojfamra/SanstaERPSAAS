const prisma = require('../lib/prisma')

module.exports = async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: {
        id: req.jwtUser.id,
        is_platform_admin: true,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        is_platform_admin: true,
        trust_id: true,
      },
    })

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'Platform administrator access required',
        code: 'PLATFORM_ADMIN_REQUIRED',
      })
    }

    req.platformAdmin = user
    next()
  } catch (err) {
    next(err)
  }
}
