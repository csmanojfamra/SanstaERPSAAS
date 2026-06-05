const DEV_SLUG_KEY = 'dev_tenant_slug'

export function getTenantSlugFromHost() {
  const host = window.location.hostname.toLowerCase()

  if (host === 'localhost' || host === '127.0.0.1') {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('tenant')
    if (fromQuery) {
      localStorage.setItem(DEV_SLUG_KEY, fromQuery.trim().toLowerCase())
      return fromQuery.trim().toLowerCase()
    }
    const stored = localStorage.getItem(DEV_SLUG_KEY)
    return stored || null
  }

  const baseDomain = (import.meta.env.VITE_TENANT_BASE_DOMAIN || '').toLowerCase().trim()
  if (baseDomain && (host === baseDomain || host.endsWith(`.${baseDomain}`))) {
    const sub = host === baseDomain ? '' : host.slice(0, -(baseDomain.length + 1))
    if (sub && !['www', 'app', 'api', 'admin', 'platform'].includes(sub)) return sub
  }

  const parts = host.split('.')
  if (parts.length >= 3 && !['www', 'app', 'api', 'admin', 'platform'].includes(parts[0])) {
    return parts[0]
  }

  if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0]
  }

  return null
}

export function persistDevTenantSlug(slug) {
  if (slug) localStorage.setItem(DEV_SLUG_KEY, slug)
  else localStorage.removeItem(DEV_SLUG_KEY)
}

export function buildLocalTenantLoginUrl(slug) {
  if (!slug) return `${window.location.origin}${import.meta.env.BASE_URL}login`
  const port = window.location.port ? `:${window.location.port}` : ''
  return `${window.location.protocol}//${slug}.localhost${port}${import.meta.env.BASE_URL}login`
}
