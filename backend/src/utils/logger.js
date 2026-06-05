const log = (level, message, meta = {}) => {
  const ts = new Date().toISOString()
  const metaStr = Object.keys(meta).length ? ' | ' + JSON.stringify(meta) : ''
  console.log(`[${ts}] [${level.toUpperCase()}] ${message}${metaStr}`)
}

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
}

