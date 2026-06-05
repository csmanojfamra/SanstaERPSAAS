const router = require('express').Router()
const prisma = require('../../lib/prisma')
const { resolveTrustFromRequest, tenantPublicConfig } = require('../../services/tenant.service')
const { buildTenantLoginUrl } = require('../../utils/tenantHost')

const cache = {}
const CACHE_TTL = 5 * 60 * 1000

function getCache(key) {
  const entry = cache[key]
  if (!entry) return null
  if (Date.now() - entry.cachedAt > CACHE_TTL) {
    delete cache[key]
    return null
  }
  return entry.data
}

function setCache(key, data) {
  cache[key] = { data, cachedAt: Date.now() }
}

// GET /api/v1/public/tenant-config — white-label login branding (subdomain / ?tenant=)
router.get('/tenant-config', async (req, res, next) => {
  try {
    const { trust, slug, error } = await resolveTrustFromRequest(req)

    if (error === 'TRUST_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Trust not found',
        code: 'TRUST_NOT_FOUND',
      })
    }

    if (!trust) {
      return res.json({
        success: true,
        tenant: null,
        message: 'No tenant context — use trust subdomain or ?tenant=slug on localhost',
      })
    }

    res.json({
      success: true,
      tenant: {
        ...tenantPublicConfig(trust),
        login_url: buildTenantLoginUrl(trust.slug),
      },
      slug,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/public/donors/:trustId
router.get('/donors/:trustId', async (req, res, next) => {
  try {
    const { trustId } = req.params
    const trust = await prisma.trust.findFirst({
      where: { id: trustId, is_active: true },
      select: { donor_threshold: true, top_donors_limit: true, name: true },
    })

    if (!trust) {
      return res.status(404).json({
        success: false,
        message: 'Trust not found',
        code: 'NOT_FOUND',
      })
    }

    const limit = trust.top_donors_limit ?? 10
    const cacheKey = `donors_${trustId}_thr_${trust.donor_threshold}_limit_${limit}`

    const cached = getCache(cacheKey)
    if (cached) return res.json(cached)

    // Big donors = donors whose (single donation) amount is >= donor_threshold
    // Then we compute total amount per donor_mobile to rank the top donors.
    const donorsByMobileRaw = await prisma.donation.groupBy({
      by: ['donor_mobile'],
      where: {
        trust_id: trustId,
        is_deleted: false,
        amount: { gte: trust.donor_threshold },
      },
      _sum: { amount: true },
      _count: { id: true },
    })

    const donorsSorted = donorsByMobileRaw
      .map((d) => ({
        donor_mobile: d.donor_mobile,
        total_amount: d._sum.amount || 0,
        donation_count: d._count.id || 0,
      }))
      .sort((a, b) => Number(b.total_amount) - Number(a.total_amount))
      .slice(0, Math.max(1, limit))

    const donors = await Promise.all(
      donorsSorted.map(async (d) => {
        const info = await prisma.donation.findFirst({
          where: { trust_id: trustId, is_deleted: false, donor_mobile: d.donor_mobile },
          orderBy: { donation_date: 'desc' },
          select: { donor_name: true, donor_city: true },
        })

        return {
          donor_name: info?.donor_name || '',
          donor_city: info?.donor_city || null,
          amount: d.total_amount,
          donation_count: d.donation_count,
        }
      }),
    )

    const stats = await prisma.donation.aggregate({
      where: { trust_id: trustId, is_deleted: false },
      _sum: { amount: true },
      _count: { id: true },
    })

    const response = {
      success: true,
      donors,
      threshold: trust.donor_threshold,
      top_donors_limit: limit,
      total_donors: stats._count.id || 0,
      total_amount_collected: stats._sum.amount || 0,
    }

    setCache(cacheKey, response)
    res.json(response)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/public/stats/:trustId
router.get('/stats/:trustId', async (req, res, next) => {
  try {
    const { trustId } = req.params
    const cacheKey = `stats_${trustId}`

    const cached = getCache(cacheKey)
    if (cached) return res.json(cached)

    const trust = await prisma.trust.findFirst({
      where: { id: trustId, is_active: true },
      select: { id: true },
    })

    if (!trust) {
      return res.status(404).json({
        success: false,
        message: 'Trust not found',
      })
    }

    const [aggregate, uniqueDonors] = await Promise.all([
      prisma.donation.aggregate({
        where: { trust_id: trustId, is_deleted: false },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.donation.groupBy({
        by: ['donor_mobile'],
        where: { trust_id: trustId, is_deleted: false },
      }),
    ])

    const response = {
      success: true,
      total_donations: aggregate._count.id || 0,
      total_amount: aggregate._sum.amount || 0,
      unique_donors: uniqueDonors.length,
      last_updated: new Date(),
    }

    setCache(cacheKey, response)
    res.json(response)
  } catch (err) {
    next(err)
  }
})

module.exports = router
