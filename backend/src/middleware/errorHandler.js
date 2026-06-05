module.exports = (err, req, res, next) => {
  const ts = new Date().toISOString()
  console.error(`[${ts}] [ERROR] ${req.method} ${req.url} | ${err.message}`)

  if (err.name === 'ZodError') {
    const first = err.errors?.[0]
    return res.status(400).json({
      success: false,
      message: first?.message || 'Invalid input data',
      code: 'VALIDATION_ERROR',
    })
  }

  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'A record with this value already exists',
      code: 'DUPLICATE_RECORD',
    })
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Record not found',
      code: 'NOT_FOUND',
    })
  }

  // Numeric / decimal overflow (e.g. amount exceeds DB column)
  if (err.code === 'P2000' || err.message?.includes('numeric field overflow')) {
    return res.status(400).json({
      success: false,
      message: 'Value is too large for this field',
      code: 'VALUE_OUT_OF_RANGE',
    })
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: 'SERVER_ERROR',
  })
}

