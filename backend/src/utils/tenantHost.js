const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'platform', 'mail', 'ftp'])

function normalizeHostname(host) {
  if (!host) return ''
  return String(host).split(':')[0].toLowerCase().trim()
}

function parseSlugFromHostname(hostname) {
  const host = normalizeHostname(hostname)
  if (!host || host === 'localhost' || host === '127.0.0.1') return null

  const baseDomain = (process.env.TENANT_BASE_DOMAIN || '').toLowerCase().trim()
  if (baseDomain && (host === baseDomain || host.endsWith(`.${baseDomain}`))) {
    const sub = host === baseDomain ? '' : host.slice(0, -(baseDomain.length + 1))
    if (!sub || sub.includes('.')) return null
    if (RESERVED_SUBDOMAINS.has(sub)) return null
    return sub
  }

  const parts = host.split('.')
  if (parts.length >= 3 && !RESERVED_SUBDOMAINS.has(parts[0])) {
    return parts[0]
  }

  if (parts.length === 2 && parts[1] === 'localhost' && !RESERVED_SUBDOMAINS.has(parts[0])) {
    return parts[0]
  }

  return null
}

function getTenantSlugFromRequest(req) {
  const headerSlug = req.headers['x-tenant-slug']
  if (headerSlug && typeof headerSlug === 'string') {
    const trimmed = headerSlug.trim().toLowerCase()
    if (trimmed) return trimmed
  }

  const querySlug = req.query?.tenant
  if (querySlug && typeof querySlug === 'string') {
    const trimmed = querySlug.trim().toLowerCase()
    if (trimmed) return trimmed
  }

  const host =
    req.headers['x-forwarded-host'] ||
    req.headers['x-tenant-host'] ||
    req.headers.host ||
    req.hostname

  return parseSlugFromHostname(host)
}

function buildTenantLoginUrl(slug) {
  const baseDomain = process.env.TENANT_BASE_DOMAIN
  const adminPath = process.env.ADMIN_PATH || '/admin/login'
  if (!slug || !baseDomain) return null
  const protocol = process.env.TENANT_URL_PROTOCOL || 'https'
  return `${protocol}://${slug}.${baseDomain}${adminPath}`
}

module.exports = {
  RESERVED_SUBDOMAINS,
  normalizeHostname,
  parseSlugFromHostname,
  getTenantSlugFromRequest,
  buildTenantLoginUrl,
}
