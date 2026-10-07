const fs = require('fs')
const { formatIndianNumber } = require('../utils/hindiNumbers')

const paymentModeMap = {
  CASH: 'Cash',
  UPI: 'UPI',
  CHEQUE: 'Cheque',
  NEFT: 'NEFT',
  RTGS: 'RTGS',
  DD: 'Demand Draft',
  ONLINE: 'Online',
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-GB')
}

function toWhatsAppPhone(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '')
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`
  if (/^91[6-9]\d{9}$/.test(digits)) return digits
  return null
}

function receiptMessage(donation, trust, receiptUrl) {
  const trustName = trust?.name_hindi || trust?.name || 'Sanstha'
  return [
    `*${trustName}*`,
    '',
    'Donation Receipt',
    '',
    `Receipt No: ${donation.receipt_number}`,
    `Donor: ${donation.donor_name}`,
    `Amount: ₹${formatIndianNumber(Number(donation.amount))}/-`,
    `Date: ${formatDate(donation.donation_date)}`,
    `Payment Mode: ${paymentModeMap[donation.payment_mode] || donation.payment_mode || ''}`,
    '',
    'आपके सहयोग के लिए धन्यवाद।',
    receiptUrl ? `Receipt: ${receiptUrl}` : null,
    trust?.phone ? `Contact: ${trust.phone}` : null,
  ]
    .filter((line) => line != null)
    .join('\n')
    .trim()
}

function errorMessage(data, fallback) {
  if (!data) return fallback
  if (typeof data === 'string') return data
  return (
    data.message ||
    data.error ||
    data?.data?.message ||
    data?.data?.error ||
    fallback
  )
}

async function whatomate(config, method, urlPath, { json, form } = {}) {
  const headers = { 'X-API-Key': config.apiKey }
  const init = {
    method,
    headers,
    signal: AbortSignal.timeout(20000),
  }
  if (json) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(json)
  } else if (form) {
    init.body = form
  }

  const res = await fetch(`${config.baseUrl}${urlPath}`, init)
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
  }
  if (!res.ok || data?.status === 'error') {
    const err = new Error(errorMessage(data, res.statusText || 'Whatomate request failed'))
    err.status = res.status
    throw err
  }
  return data
}

async function findContact(config, phone) {
  const data = await whatomate(
    config,
    'GET',
    `/api/contacts?search=${encodeURIComponent(phone)}&limit=50`
  )
  const contacts = data?.data?.contacts || []
  return (
    contacts.find((contact) => String(contact.phone_number || '').replace(/\D/g, '') === phone) ||
    null
  )
}

async function findOrCreateContact(config, phone, name) {
  const existing = await findContact(config, phone)
  if (existing) return existing

  try {
    const created = await whatomate(config, 'POST', '/api/contacts', {
      json: {
        phone_number: phone,
        profile_name: name || phone,
        whatsapp_account: config.accountName,
      },
    })
    return created?.data
  } catch (err) {
    const again = await findContact(config, phone)
    if (again) return again
    throw err
  }
}

async function sendTemplate(config, phone, donation, trust, receiptUrl, filePath) {
  const filename = `${String(donation.receipt_number || 'receipt').replace(/[^\w.-]+/g, '-')}.pdf`
  const params = {
    1: String(donation.donor_name || 'Donor').slice(0, 80),
    2: String(donation.receipt_number || 'receipt').slice(0, 40),
    3: `Rs ${formatIndianNumber(Number(donation.amount))}`,
    4: formatDate(donation.donation_date),
    5: String(trust?.name_hindi || trust?.name || 'Sanstha').slice(0, 80),
  }
  const fields = {
    phone_number: phone,
    template_name: config.templateName,
    account_name: config.accountName,
    template_params: params,
    header_media_filename: filename,
  }

  let data
  if (filePath && fs.existsSync(filePath)) {
    const form = new FormData()
    form.append('phone_number', fields.phone_number)
    form.append('template_name', fields.template_name)
    form.append('account_name', fields.account_name)
    form.append('template_params', JSON.stringify(fields.template_params))
    form.append('header_media_filename', filename)
    form.append(
      'header_file',
      new Blob([fs.readFileSync(filePath)], { type: 'application/pdf' }),
      filename
    )
    data = await whatomate(config, 'POST', '/api/messages/template', { form })
  } else if (receiptUrl && receiptUrl.startsWith('https://')) {
    data = await whatomate(config, 'POST', '/api/messages/template', {
      json: { ...fields, header_media_url: receiptUrl },
    })
  } else {
    throw new Error('Receipt PDF is not available to attach')
  }

  const payload = data?.data || {}
  if (payload.status === 'failed') {
    throw new Error(payload.error_message || 'WhatsApp template was not accepted')
  }
  return {
    sent: true,
    sid: payload.message_id || payload.id || null,
    provider: 'whatomate',
    channel: 'template',
  }
}

async function sendDocument(config, contactId, donation, caption, filePath) {
  const filename = `${String(donation.receipt_number || 'receipt').replace(/\//g, '-')}.pdf`
  const form = new FormData()
  form.append('contact_id', contactId)
  form.append('type', 'document')
  form.append('caption', caption.slice(0, 1024))
  form.append('whatsapp_account', config.accountName)
  form.append(
    'file',
    new Blob([fs.readFileSync(filePath)], { type: 'application/pdf' }),
    filename
  )
  const data = await whatomate(config, 'POST', '/api/messages/media', { form })
  const message = data?.data || {}
  if (message.status === 'failed') {
    throw new Error(message.error_message || 'WhatsApp document was not accepted')
  }
  return {
    sent: true,
    sid: message.id || message.wamid || null,
    provider: 'whatomate',
    channel: 'document',
  }
}

async function sendText(config, contactId, body) {
  const data = await whatomate(config, 'POST', `/api/contacts/${contactId}/messages`, {
    json: {
      type: 'text',
      whatsapp_account: config.accountName,
      content: { body: body.slice(0, 4096) },
    },
  })
  const message = data?.data || {}
  if (message.status === 'failed') {
    throw new Error(message.error_message || 'WhatsApp text was not accepted')
  }
  return {
    sent: true,
    sid: message.id || message.wamid || null,
    provider: 'whatomate',
    channel: 'text',
  }
}

const PENDING_TEMPLATE_REASON =
  'Donation receipt template is pending Meta approval. WhatsApp will send after it is approved.'

async function sendReceiptWhatsApp(donation, trust, { receiptUrl, filePath, config } = {}) {
  if (config && config.enabled === false) {
    return { sent: false, reason: 'whatsapp_disabled' }
  }
  if (!config?.apiKey) {
    return { sent: false, reason: 'not_configured' }
  }

  const phone = toWhatsAppPhone(donation.donor_mobile)
  if (!phone) {
    return { sent: false, reason: 'invalid_mobile' }
  }

  let templateError = null
  try {
    return await sendTemplate(config, phone, donation, trust, receiptUrl, filePath)
  } catch (err) {
    templateError = err
    console.error('WhatsApp template send failed:', err.message)
  }

  try {
    const contact = await findOrCreateContact(config, phone, donation.donor_name)
    if (contact?.id && contact.service_window_open === true) {
      const caption = receiptMessage(donation, trust, receiptUrl)
      if (filePath && fs.existsSync(filePath)) {
        return await sendDocument(config, contact.id, donation, caption, filePath)
      }
      return await sendText(config, contact.id, caption)
    }
  } catch (err) {
    console.error('WhatsApp session send failed:', err.message)
    if (!templateError) templateError = err
  }

  const message = templateError?.message || ''
  if (/not approved/i.test(message)) {
    return { sent: false, reason: PENDING_TEMPLATE_REASON }
  }
  return { sent: false, reason: message || 'Failed to send WhatsApp message' }
}

async function sendNoticeWhatsApp({ mobile, name, body, config }) {
  if (config && config.enabled === false) {
    return { sent: false, reason: 'whatsapp_disabled' }
  }
  if (!config?.apiKey) {
    return { sent: false, reason: 'not_configured' }
  }
  const phone = toWhatsAppPhone(mobile)
  if (!phone) {
    return { sent: false, reason: 'invalid_mobile' }
  }
  try {
    const contact = await findOrCreateContact(config, phone, name)
    if (!contact?.id) {
      return { sent: false, reason: 'Could not open a WhatsApp chat for this number' }
    }
    return await sendText(config, contact.id, body)
  } catch (err) {
    return { sent: false, reason: err.message || 'Failed to send WhatsApp message' }
  }
}

module.exports = { sendReceiptWhatsApp, sendNoticeWhatsApp }
