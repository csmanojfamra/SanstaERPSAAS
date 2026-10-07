const fs = require('fs')
const prisma = require('../lib/prisma')
const logger = require('../utils/logger')
const { sendReceiptWhatsApp } = require('./whatsapp.service')
const { resolveWhatsAppConfig } = require('./whatsappConfig.service')
const { getReceiptFilePath } = require('./storage.service')
const { createNotification } = require('./notification.service')
const { createAuditLog } = require('./audit.service')

async function dispatchReceiptWhatsApp(donation, trust, { audit } = {}) {
  const { filepath, publicPath } = getReceiptFilePath(donation.receipt_number)
  const receiptPath = donation.receipt_pdf_path || publicPath
  const fullUrl = `${process.env.PUBLIC_URL || ''}${receiptPath.startsWith('/') ? receiptPath : `/${receiptPath}`}`

  const config = await resolveWhatsAppConfig(trust)
  const result = await sendReceiptWhatsApp(donation, trust, {
    receiptUrl: fullUrl,
    filePath: fs.existsSync(filepath) ? filepath : null,
    config,
  })

  if (result.sent) {
    await prisma.donation.updateMany({
      where: { id: donation.id, trust_id: trust.id },
      data: {
        whatsapp_sent: true,
        whatsapp_sent_at: new Date(),
      },
    })
    logger.info('WhatsApp receipt sent', {
      receipt: donation.receipt_number,
      provider: 'whatomate',
      channel: result.channel,
    })
    if (audit) {
      await createAuditLog({
        ...audit,
        module: audit.module || 'DONATIONS',
        action: 'WHATSAPP_SEND',
        entity_type: 'Donation',
        entity_id: donation.id,
        description: `WhatsApp receipt sent for ${donation.receipt_number}`,
        metadata: { donor_mobile: donation.donor_mobile, channel: result.channel },
      })
    }
    return result
  }

  logger.warn('WhatsApp receipt not sent', {
    receipt: donation.receipt_number,
    reason: result.reason,
  })

  if (result.reason && result.reason !== 'not_configured' && result.reason !== 'whatsapp_disabled') {
    await createNotification({
      trust_id: trust.id,
      type: 'RECEIPT',
      title: 'WhatsApp Send Failed',
      message: `Failed to send WhatsApp for receipt ${donation.receipt_number}`,
      priority: 'MEDIUM',
    })
  }

  return result
}

module.exports = { dispatchReceiptWhatsApp }
