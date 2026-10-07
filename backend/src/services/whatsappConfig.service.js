const prisma = require('../lib/prisma')

const DEFAULTS = {
  base_url: 'https://wa.fastlegal.in',
  account_name: 'fastlegal',
  template_name: 'donation_receipt',
}

function usableEnvKey() {
  const key = (process.env.WHATOMATE_API_KEY || '').trim()
  if (!key || key === 'whm_your_api_key') return ''
  return key
}

function maskApiKey(key) {
  if (!key) return ''
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

async function getPlatformWhatsAppRow() {
  return prisma.platformWhatsApp.findUnique({ where: { id: 'default' } })
}

function publicWhatsAppSettings(row) {
  const storedKey = (row?.api_key || '').trim()
  const envKey = usableEnvKey()
  const activeKey = storedKey || envKey
  return {
    base_url: (row?.base_url || process.env.WHATOMATE_BASE_URL || DEFAULTS.base_url).replace(/\/$/, ''),
    account_name: (row?.account_name || process.env.WHATOMATE_ACCOUNT_NAME || DEFAULTS.account_name).trim(),
    template_name: (row?.template_name || process.env.WHATOMATE_RECEIPT_TEMPLATE || DEFAULTS.template_name).trim(),
    has_api_key: Boolean(activeKey),
    api_key_hint: activeKey ? maskApiKey(activeKey) : '',
    api_key_source: storedKey ? 'panel' : envKey ? 'env' : 'missing',
  }
}

async function resolveWhatsAppConfig(trust) {
  const row = await getPlatformWhatsAppRow()
  const settings = publicWhatsAppSettings(row)
  const storedKey = (row?.api_key || '').trim()
  return {
    enabled: trust?.whatsapp_enabled !== false,
    apiKey: storedKey || usableEnvKey(),
    baseUrl: settings.base_url,
    accountName: (trust?.whatsapp_account || settings.account_name || DEFAULTS.account_name).trim(),
    templateName: (trust?.whatsapp_template || settings.template_name || DEFAULTS.template_name).trim(),
  }
}

module.exports = {
  DEFAULTS,
  maskApiKey,
  getPlatformWhatsAppRow,
  publicWhatsAppSettings,
  resolveWhatsAppConfig,
}
