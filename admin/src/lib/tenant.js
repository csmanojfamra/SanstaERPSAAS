const DEV_SLUG_KEY = 'dev_tenant_slug'

/** Optional trust branding via ?tenant=slug only (no subdomain slug parsing). */
export function getTenantSlugFromHost() {
  const params = new URLSearchParams(window.location.search)
  const fromQuery = params.get('tenant')
  if (fromQuery) {
    const slug = fromQuery.trim().toLowerCase()
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      localStorage.setItem(DEV_SLUG_KEY, slug)
    }
    return slug
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return localStorage.getItem(DEV_SLUG_KEY) || null
  }

  return null
}

export function persistDevTenantSlug(slug) {
  if (slug) localStorage.setItem(DEV_SLUG_KEY, slug)
  else localStorage.removeItem(DEV_SLUG_KEY)
}

export function buildLocalTenantLoginUrl(slug) {
  if (!slug) return `${window.location.origin}${import.meta.env.BASE_URL}login`
  return `${window.location.origin}${import.meta.env.BASE_URL}login?tenant=${encodeURIComponent(slug)}`
}
