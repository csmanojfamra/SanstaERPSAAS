const crypto = require('crypto')
const QRCode = require('qrcode')
const prisma = require('../lib/prisma')
const { resolveWhatsAppConfig } = require('./whatsappConfig.service')
const { sendPrasadWhatsApp } = require('./whatsapp.service')
const { upsertDonor } = require('./donor.service')
const { publicOrigin } = require('../utils/publicUrl')

function packetCount(amount, rupeesPerPacket) {
  const rate = Math.max(1, Math.floor(Number(rupeesPerPacket) || 100))
  const packets = Math.floor(Number(amount) / rate)
  return { rate, packets: Math.max(1, packets) }
}

function publicBase(req) {
  return publicOrigin(req)
}

function presentToken(token, extras = {}) {
  return {
    id: token.id,
    code: token.code,
    donor_name: token.donor_name,
    donor_mobile: token.donor_mobile,
    amount: Number(token.amount),
    packets: token.packets,
    rupees_per_packet: token.rupees_per_packet,
    status: token.status,
    redeemed_at: token.redeemed_at,
    whatsapp_sent: token.whatsapp_sent,
    created_at: token.created_at,
    public_url: extras.public_url || null,
    qr_data_url: extras.qr_data_url || null,
  }
}

function tokenMessage(trust, token, url) {
  const trustName = trust?.name_hindi || trust?.name || 'Mandir'
  return [
    trustName,
    '',
    'Prasad token',
    `Name: ${token.donor_name}`,
    `Amount: Rs ${Number(token.amount).toLocaleString('en-IN')}`,
    `Packets: ${token.packets}`,
    '',
    'Show this at the prasad counter. This token works only once.',
    url,
  ].join('\n')
}

async function issuePrasadToken(req, input) {
  const { rate, packets } = packetCount(input.amount, input.rupees_per_packet)
  const code = crypto.randomBytes(16).toString('base64url')
  const token = await prisma.prasadToken.create({
    data: {
      trust_id: req.trustId,
      code,
      donor_name: input.donor_name.trim(),
      donor_mobile: input.donor_mobile,
      amount: input.amount,
      packets,
      rupees_per_packet: rate,
      issued_by: req.user?.id || null,
    },
  })

  try {
    await upsertDonor(req.trustId, {
      name: token.donor_name,
      mobile: token.donor_mobile,
    })
  } catch (err) {
    console.error('Prasad donor save failed:', err.message)
  }

  const publicUrl = `${publicBase(req)}/p/${code}`
  const qrPng = await QRCode.toBuffer(publicUrl, {
    type: 'png',
    margin: 2,
    width: 512,
    errorCorrectionLevel: 'M',
  })
  const qrDataUrl = `data:image/png;base64,${qrPng.toString('base64')}`
  const whatsapp = await deliverTokenWhatsApp(req, token, publicUrl, qrPng)

  return {
    token: presentToken(token, { public_url: publicUrl, qr_data_url: qrDataUrl }),
    whatsapp,
  }
}

async function deliverTokenWhatsApp(req, token, publicUrl, qrPng) {
  let whatsapp = { sent: false, reason: 'not_sent' }
  try {
    const config = await resolveWhatsAppConfig(req.trust)
    whatsapp = await sendPrasadWhatsApp({
      mobile: token.donor_mobile,
      name: token.donor_name,
      caption: tokenMessage(req.trust, token, publicUrl),
      image: qrPng,
      amount: `Rs ${Number(token.amount).toLocaleString('en-IN')}`,
      packets: token.packets,
      config,
    })
    if (whatsapp.sent) {
      await prisma.prasadToken.update({
        where: { id: token.id },
        data: { whatsapp_sent: true },
      })
      token.whatsapp_sent = true
    }
  } catch (err) {
    whatsapp = { sent: false, reason: err.message || 'Failed to send WhatsApp' }
  }
  return whatsapp
}

async function resendPrasadWhatsApp(req, id) {
  const token = await prisma.prasadToken.findFirst({
    where: { id, trust_id: req.trustId },
  })
  if (!token) return null
  const publicUrl = `${publicBase(req)}/p/${token.code}`
  const qrPng = await QRCode.toBuffer(publicUrl, {
    type: 'png',
    margin: 2,
    width: 512,
    errorCorrectionLevel: 'M',
  })
  const whatsapp = await deliverTokenWhatsApp(req, token, publicUrl, qrPng)
  return { token: presentToken(token), whatsapp }
}

function istBound(day, end) {
  if (!day) return null
  return new Date(`${day}T${end ? '23:59:59.999' : '00:00:00'}+05:30`)
}

function todayIst() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function accountWhere(trustId, fromDay, toDay) {
  return {
    trust_id: trustId,
    created_at: {
      gte: istBound(fromDay, false),
      lte: istBound(toDay, true),
    },
  }
}

function mergeAccountRows(allRows, givenRows, keyName) {
  const givenByKey = new Map(givenRows.map((row) => [Number(row[keyName]), row]))
  return allRows
    .map((row) => {
      const key = Number(row[keyName])
      const given = givenByKey.get(key)
      const tokens = row._count._all
      const packets = Number(row._sum.packets || 0)
      const givenPackets = Number(given?._sum.packets || 0)
      const givenTokens = given?._count._all || 0
      return {
        value: Number(key),
        tokens,
        amount: Number(row._sum.amount || 0),
        packets,
        given_tokens: givenTokens,
        open_tokens: tokens - givenTokens,
        given_packets: givenPackets,
        open_packets: packets - givenPackets,
      }
    })
    .sort((a, b) => a.value - b.value)
}

function accountTotal(rows) {
  return rows.reduce(
    (sum, row) => ({
      tokens: sum.tokens + row.tokens,
      amount: sum.amount + row.amount,
      packets: sum.packets + row.packets,
      given_tokens: sum.given_tokens + row.given_tokens,
      open_tokens: sum.open_tokens + row.open_tokens,
      given_packets: sum.given_packets + row.given_packets,
      open_packets: sum.open_packets + row.open_packets,
    }),
    {
      tokens: 0,
      amount: 0,
      packets: 0,
      given_tokens: 0,
      open_tokens: 0,
      given_packets: 0,
      open_packets: 0,
    },
  )
}

async function prasadAccount(trustId, query = {}) {
  const from = query.from || query.to || todayIst()
  const to = query.to || query.from || from
  const where = accountWhere(trustId, from, to)
  const givenWhere = { ...where, status: 'REDEEMED' }

  const [byRate, givenByRate, byAmount, givenByAmount] = await Promise.all([
    prisma.prasadToken.groupBy({
      by: ['rupees_per_packet'],
      where,
      _count: { _all: true },
      _sum: { amount: true, packets: true },
    }),
    prisma.prasadToken.groupBy({
      by: ['rupees_per_packet'],
      where: givenWhere,
      _count: { _all: true },
      _sum: { amount: true, packets: true },
    }),
    prisma.prasadToken.groupBy({
      by: ['amount'],
      where,
      _count: { _all: true },
      _sum: { amount: true, packets: true },
    }),
    prisma.prasadToken.groupBy({
      by: ['amount'],
      where: givenWhere,
      _count: { _all: true },
      _sum: { amount: true, packets: true },
    }),
  ])

  const rates = mergeAccountRows(byRate, givenByRate, 'rupees_per_packet')
  const amounts = mergeAccountRows(byAmount, givenByAmount, 'amount')
  return {
    from,
    to,
    by_rate: rates,
    by_amount: amounts,
    total: accountTotal(rates),
  }
}

async function listPrasadTokens(trustId, query = {}) {
  const q = String(query.q || '').trim()
  const digits = q.replace(/\D/g, '')
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50))
  const where = { trust_id: trustId }
  if (query.status === 'ISSUED' || query.status === 'REDEEMED') where.status = query.status
  const from = istBound(query.from, false)
  const to = istBound(query.to, true)
  if (from || to) {
    where.created_at = {}
    if (from) where.created_at.gte = from
    if (to) where.created_at.lte = to
  }
  if (q) {
    where.OR = [
      { donor_name: { contains: q, mode: 'insensitive' } },
      ...(digits ? [{ donor_mobile: { contains: digits } }] : []),
    ]
  }

  const [rows, total, sums, redeemed] = await Promise.all([
    prisma.prasadToken.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.prasadToken.count({ where }),
    prisma.prasadToken.aggregate({
      where,
      _sum: { amount: true, packets: true },
    }),
    prisma.prasadToken.count({ where: { ...where, status: 'REDEEMED' } }),
  ])

  return {
    tokens: rows.map((row) => presentToken(row)),
    page,
    limit,
    total,
    summary: {
      count: total,
      amount: Number(sums._sum.amount || 0),
      packets: Number(sums._sum.packets || 0),
      redeemed,
      open: total - redeemed,
    },
  }
}

async function findTokenByCode(code) {
  return prisma.prasadToken.findUnique({
    where: { code },
    include: { trust: true },
  })
}

async function redeemPrasadToken(code) {
  const updated = await prisma.prasadToken.updateMany({
    where: { code, status: 'ISSUED' },
    data: { status: 'REDEEMED', redeemed_at: new Date() },
  })
  return updated.count === 1
}

module.exports = {
  packetCount,
  issuePrasadToken,
  resendPrasadWhatsApp,
  listPrasadTokens,
  prasadAccount,
  findTokenByCode,
  redeemPrasadToken,
}
