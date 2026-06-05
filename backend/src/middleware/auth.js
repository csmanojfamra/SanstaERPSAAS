const jwt = require('jsonwebtoken')

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'NO_TOKEN',
    })
  }

  const token = authHeader.split(' ')[1]
  try {
    // MIGRATION NOTE:
    // To switch to Supabase Auth later, replace jwt.verify with:
    // const { data: { user }, error } = await supabase.auth.getUser(token)
    // if (error || !user) return 401 response
    // Everything else stays the same.
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.jwtUser = decoded
    next()
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError' ? 'Session expired. Please login again.' : 'Invalid authentication token'
    return res.status(401).json({
      success: false,
      message,
      code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
    })
  }
}

