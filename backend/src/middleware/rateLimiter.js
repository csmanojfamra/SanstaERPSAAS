const rateLimit = require('express-rate-limit')

// Set ENABLE_LOGIN_RATE_LIMIT=true in production when ready (off by default for now)
const loginLimiter =
  process.env.ENABLE_LOGIN_RATE_LIMIT === 'true'
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: {
          success: false,
          message: 'Too many login attempts. Please try again in 15 minutes.',
          code: 'TOO_MANY_REQUESTS',
        },
      })
    : (req, res, next) => next()

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    message: 'Too many requests.',
    code: 'TOO_MANY_REQUESTS',
  },
})

module.exports = { loginLimiter, apiLimiter }

