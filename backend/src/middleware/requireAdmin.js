module.exports = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
      code: 'ADMIN_REQUIRED',
    })
  }
  next()
}

