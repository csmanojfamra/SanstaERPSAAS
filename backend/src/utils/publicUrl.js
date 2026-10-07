function cleanOrigin(value) {
  const parts = String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  for (const part of parts) {
    try {
      const url = new URL(part)
      const host = url.hostname.toLowerCase()
      if (!host || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') continue
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
      return url.origin
    } catch {
      // Ignore a broken entry and try the next one.
    }
  }
  return ''
}

function publicOrigin(req) {
  const fromEnv = cleanOrigin(process.env.PUBLIC_URL) || cleanOrigin(process.env.APP_URL)
  if (fromEnv) return fromEnv
  if (!req || typeof req.get !== 'function') return ''

  const host = String(req.get('x-forwarded-host') || req.get('host') || '')
    .split(',')[0]
    .trim()
  if (!host) return ''

  const hostname = host.split(':')[0].toLowerCase()
  const local = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'
  const proto = String(req.get('x-forwarded-proto') || (local ? req.protocol : 'https') || 'https')
    .split(',')[0]
    .trim()
  return `${proto}://${host}`
}

function publicUrl(req, path) {
  const origin = publicOrigin(req)
  const suffix = String(path || '').startsWith('/') ? String(path || '') : `/${path || ''}`
  return origin ? `${origin}${suffix}` : suffix
}

module.exports = { cleanOrigin, publicOrigin, publicUrl }
