const crypto = require('crypto')
const QRCode = require('qrcode')
const prisma = require('../lib/prisma')
const { resolveWhatsAppConfig } = require('./whatsappConfig.service')
const { sendNoticeWhatsApp } = require('./whatsapp.service')
const { upsertDonor } = require('./donor.service')

function packetCount(amount, rupeesPerPacket) {
  const rate = Math.max(1, Math.floor(Number(rupeesPerPacket) || 100))
  const packets = Math.floor(Number(amount) / rate)
  return { rate, packets: Math.max(1, packets) }
}

function publicBase(req) {
  const configured = (process.env.PUBLIC_URL || process.env.APP_URL || '').replace(/\/$/, '')
  if (configured) return configured
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https'
  const host = req.get('x-forwarded-host') || req.get('host')
  return `${proto}://${host}`
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
  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    margin: 1,
    width: 320,
    errorCorrectionLevel: 'M',
  })

  let whatsapp = { sent: false, reason: 'not_sent' }
  try {
    const config = await resolveWhatsAppConfig(req.trust)
    whatsapp = await sendNoticeWhatsApp({
      mobile: token.donor_mobile,
      name: token.donor_name,
      body: tokenMessage(req.trust, token, publicUrl),
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

  return {
    token: presentToken(token, { public_url: publicUrl, qr_data_url: qrDataUrl }),
    whatsapp,
  }
}

async function listPrasadTokens(trustId) {
  const rows = await prisma.prasadToken.findMany({
    where: { trust_id: trustId },
    orderBy: { created_at: 'desc' },
    take: 40,
  })
  return rows.map((row) => presentToken(row))
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
  listPrasadTokens,
  findTokenByCode,
  redeemPrasadToken,
}
