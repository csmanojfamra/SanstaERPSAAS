const prisma = require('../lib/prisma')

function blankToNull(value) {
  const text = String(value || '').trim()
  return text || null
}

function normalMobile(value) {
  const digits = String(value || '').replace(/\D/g, '')
  const mobile = digits.length > 10 ? digits.slice(-10) : digits
  return /^[6-9]\d{9}$/.test(mobile) ? mobile : null
}

function presentDonor(row) {
  return {
    name: row.name || row.donor_name,
    mobile: row.mobile || row.donor_mobile,
    city: row.city || row.donor_city || '',
    email: row.email || row.donor_email || '',
    address: row.address || row.donor_address || '',
    state: row.state || row.donor_state || '',
    pincode: row.pincode || row.donor_pincode || '',
    donor_type: row.donor_type || 'INDIVIDUAL',
    pan_number: row.pan_number || '',
  }
}

async function upsertDonor(trustId, fields) {
  const mobile = normalMobile(fields.mobile || fields.donor_mobile)
  const name = String(fields.name || fields.donor_name || '').trim()
  if (!mobile || name.length < 2) return null

  const update = { name }
  const city = blankToNull(fields.city || fields.donor_city)
  const email = blankToNull(fields.email || fields.donor_email)
  const address = blankToNull(fields.address || fields.donor_address)
  const state = blankToNull(fields.state || fields.donor_state)
  const pincode = blankToNull(fields.pincode || fields.donor_pincode)
  const donorType = blankToNull(fields.donor_type)
  const pan = blankToNull(fields.pan_number)
  if (city) update.city = city
  if (email) update.email = email
  if (address) update.address = address
  if (state) update.state = state
  if (pincode) update.pincode = pincode
  if (donorType) update.donor_type = donorType
  if (pan) update.pan_number = pan

  return prisma.donor.upsert({
    where: { trust_id_mobile: { trust_id: trustId, mobile } },
    create: {
      trust_id: trustId,
      mobile,
      name,
      city,
      email,
      address,
      state,
      pincode,
      donor_type: donorType || 'INDIVIDUAL',
      pan_number: pan,
    },
    update,
  })
}

async function searchDonors(trustId, q) {
  const term = String(q || '').trim()
  if (term.length < 2) return []
  const digits = term.replace(/\D/g, '')
  const nameFilter = { contains: term, mode: 'insensitive' }
  const mobileFilter = digits.length >= 3 ? { contains: digits } : null

  const saved = await prisma.donor.findMany({
    where: {
      trust_id: trustId,
      OR: [{ name: nameFilter }, ...(mobileFilter ? [{ mobile: mobileFilter }] : [])],
    },
    orderBy: { updated_at: 'desc' },
    take: 8,
  })

  const seen = new Set(saved.map((row) => row.mobile))
  const results = saved.map(presentDonor)

  if (results.length < 8) {
    const donations = await prisma.donation.findMany({
      where: {
        trust_id: trustId,
        is_deleted: false,
        OR: [{ donor_name: nameFilter }, ...(mobileFilter ? [{ donor_mobile: mobileFilter }] : [])],
      },
      orderBy: { created_at: 'desc' },
      take: 30,
      select: {
        donor_name: true,
        donor_mobile: true,
        donor_city: true,
        donor_email: true,
        donor_address: true,
        donor_state: true,
        donor_pincode: true,
        donor_type: true,
        pan_number: true,
      },
    })
    for (const row of donations) {
      if (!row.donor_mobile || seen.has(row.donor_mobile)) continue
      seen.add(row.donor_mobile)
      results.push(presentDonor(row))
      if (results.length >= 8) break
    }
  }

  if (results.length < 8) {
    const receipts = await prisma.inKindReceipt.findMany({
      where: {
        trust_id: trustId,
        is_deleted: false,
        donor_mobile: { not: null },
        OR: [{ donor_name: nameFilter }, ...(mobileFilter ? [{ donor_mobile: mobileFilter }] : [])],
      },
      orderBy: { created_at: 'desc' },
      take: 20,
      select: { donor_name: true, donor_mobile: true, donor_city: true },
    })
    for (const row of receipts) {
      if (!row.donor_mobile || seen.has(row.donor_mobile)) continue
      seen.add(row.donor_mobile)
      results.push(presentDonor(row))
      if (results.length >= 8) break
    }
  }

  return results
}

module.exports = { upsertDonor, searchDonors, normalMobile }
