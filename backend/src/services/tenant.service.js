const prisma = require('../lib/prisma')
const { getTenantSlugFromRequest } = require('../utils/tenantHost')

async function resolveTrustFromRequest(req) {
  const slug = getTenantSlugFromRequest(req)
  const host = (
    req.headers['x-forwarded-host'] ||
    req.headers['x-tenant-host'] ||
    req.headers.host ||
    req.hostname ||
    ''
  )
    .split(':')[0]
    .toLowerCase()

  if (slug) {
    const trust = await prisma.trust.findFirst({
      where: { slug, is_active: true },
    })
    if (trust) return { trust, slug, matchedBy: 'slug' }
    return { trust: null, slug, matchedBy: 'slug', error: 'TRUST_NOT_FOUND' }
  }

  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    const trust = await prisma.trust.findFirst({
      where: { custom_domain: host, is_active: true },
    })
    if (trust) return { trust, slug: trust.slug, matchedBy: 'custom_domain' }
  }

  return { trust: null, slug: null, matchedBy: null }
}

function tenantPublicConfig(trust) {
  return {
    id: trust.id,
    slug: trust.slug,
    name: trust.name,
    name_hindi: trust.name_hindi,
    logo_url: trust.logo_url,
    primary_color: trust.primary_color,
    secondary_color: trust.secondary_color,
    phone: trust.phone,
    login_title: trust.name_hindi || trust.name,
  }
}

module.exports = {
  resolveTrustFromRequest,
  tenantPublicConfig,
}
