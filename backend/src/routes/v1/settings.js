const router = require('express').Router()
const { z } = require('zod')

const prisma = require('../../lib/prisma')
const { createAuditLog } = require('../../services/audit.service')
const { getAuditContext } = require('../../utils/auditContext')
const { trustSlugUpdateSchema, validate } = require('../../utils/validators')
const { buildTrustLoginUrl } = require('../../utils/tenantHost')

const settingsSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  name_hindi: z.string().min(2).max(200).optional(),
  address: z.string().min(2).max(500).optional(),
  phone: z.string().min(6).max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  logo_url: z.string().max(500).optional().or(z.literal('')),
  top_donors_limit: z.number().int().min(1).max(50).optional(),
  donor_threshold: z.number().int().min(1).max(1000000000).optional(),
  opening_cash_balance: z.number().optional(),
  opening_bank_balance: z.number().optional(),
  receipt_prefix: z.string().min(2).max(20).optional(),
  current_fy: z.string().min(4).max(20).optional(),
  primary_color: z.string().regex(/^#([A-Fa-f0-9]{6})$/, 'Invalid color').optional(),
  secondary_color: z.string().regex(/^#([A-Fa-f0-9]{6})$/, 'Invalid color').optional(),
  pan_number: z.string().max(20).optional().or(z.literal('')),
  reg_number: z.string().max(80).optional().or(z.literal('')),
  bank_name: z.string().max(100).optional().or(z.literal('')),
  bank_account: z.string().max(50).optional().or(z.literal('')),
  bank_ifsc: z.string().max(20).optional().or(z.literal('')),
  settings_json: z.object({
    general: z.object({
      reg_80g: z.string().optional(),
      reg_12a: z.string().optional(),
      city_state: z.string().optional(),
      website: z.string().optional(),
      formation_date: z.string().optional(),
    }).optional(),
    receipts: z.object({
      receipt_starting_number: z.string().optional(),
      fy_format: z.string().optional(),
      auto_generate_receipt: z.boolean().optional(),
      authorized_signatory: z.string().optional(),
      digital_signature: z.string().optional(),
      receipt_footer_note: z.string().optional(),
      receipt_terms: z.string().optional(),
      qr_verification: z.boolean().optional(),
    }).optional(),
    financial: z.object({
      financial_year_start: z.string().optional(),
      voucher_number_format: z.string().optional(),
      receipt_number_format: z.string().optional(),
      cash_book_lock_date: z.string().optional(),
      allow_backdated_entries: z.boolean().optional(),
      allow_voucher_editing: z.boolean().optional(),
    }).optional(),
    website: z.object({
      public_donor_display_settings: z.boolean().optional(),
      display_limit: z.number().optional(),
      website_banner_upload: z.string().optional(),
    }).optional(),
    branding: z.object({
      favicon_upload: z.string().optional(),
      letterhead_preview: z.string().optional(),
      website_banner_upload: z.string().optional(),
    }).optional(),
    governance: z.object({
      approval_high_value_expenses: z.boolean().optional(),
      approval_cash_above_threshold: z.boolean().optional(),
      approval_backdated_entries: z.boolean().optional(),
      approval_receipt_regeneration: z.boolean().optional(),
      approval_voucher_deletion: z.boolean().optional(),
      mandatory_bill_upload_threshold: z.number().optional(),
      allowed_attachment_types: z.string().optional(),
      max_upload_size_mb: z.number().optional(),
    }).optional(),
    security: z.object({
      two_factor_enabled: z.boolean().optional(),
      failed_login_attempts_month: z.number().optional(),
      active_sessions: z.number().optional(),
    }).optional(),
  }).optional(),
})

function mergeSettingsJson(existing = {}, incoming = {}) {
  const current = existing && typeof existing === 'object' ? existing : {}
  const next = incoming && typeof incoming === 'object' ? incoming : {}
  return {
    ...current,
    ...next,
    general: { ...(current.general || {}), ...(next.general || {}) },
    receipts: { ...(current.receipts || {}), ...(next.receipts || {}) },
    financial: { ...(current.financial || {}), ...(next.financial || {}) },
    website: { ...(current.website || {}), ...(next.website || {}) },
    branding: { ...(current.branding || {}), ...(next.branding || {}) },
    governance: { ...(current.governance || {}), ...(next.governance || {}) },
    security: { ...(current.security || {}), ...(next.security || {}) },
  }
}

router.get('/', async (req, res, next) => {
  try {
    const trust = req.trust
    return res.json({
      success: true,
      settings: {
        name: trust.name,
        name_hindi: trust.name_hindi,
        address: trust.address,
        phone: trust.phone,
        email: trust.email || '',
        logo_url: trust.logo_url || '',
        receipt_prefix: trust.receipt_prefix || 'TRUST',
        current_fy: trust.current_fy || '',
        primary_color: trust.primary_color || '#FF6B00',
        secondary_color: trust.secondary_color || '#7B1C1C',
        pan_number: trust.pan_number || '',
        reg_number: trust.reg_number || '',
        bank_name: trust.bank_name || '',
        bank_account: trust.bank_account || '',
        bank_ifsc: trust.bank_ifsc || '',
        settings_json: trust.settings_json || {},
        top_donors_limit: trust.top_donors_limit ?? 10,
        donor_threshold: trust.donor_threshold ?? 1100,
        opening_cash_balance: Number(trust.opening_cash_balance || 0),
        opening_bank_balance: Number(trust.opening_bank_balance || 0),
        slug: trust.slug || '',
        custom_domain: trust.custom_domain || '',
        login_url: buildTrustLoginUrl(trust),
      },
    })
  } catch (err) {
    next(err)
  }
})

router.put('/tenant-access', async (req, res, next) => {
  try {
    const data = validate(trustSlugUpdateSchema, req.body)

    const slugTaken = await prisma.trust.findFirst({
      where: { slug: data.slug, NOT: { id: req.trustId } },
    })
    if (slugTaken) {
      return res.status(409).json({
        success: false,
        message: 'Subdomain slug is already used by another trust',
        code: 'SLUG_TAKEN',
      })
    }

    const domain = data.custom_domain?.trim() || null
    if (domain) {
      const domainTaken = await prisma.trust.findFirst({
        where: { custom_domain: domain, NOT: { id: req.trustId } },
      })
      if (domainTaken) {
        return res.status(409).json({
          success: false,
          message: 'Custom domain is already used by another trust',
          code: 'DOMAIN_TAKEN',
        })
      }
    }

    await prisma.trust.updateMany({
      where: { id: req.trustId },
      data: { slug: data.slug, custom_domain: domain },
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'SETTINGS',
      action: 'UPDATE',
      entity_type: 'Trust',
      entity_id: req.trustId,
      description: 'Trust login URL / subdomain updated',
      metadata: { slug: data.slug, custom_domain: domain },
    })

    const refreshed = await prisma.trust.findFirst({ where: { id: req.trustId } })

    return res.json({
      success: true,
      slug: refreshed.slug,
      custom_domain: refreshed.custom_domain || '',
      login_url: buildTrustLoginUrl(refreshed),
    })
  } catch (err) {
    next(err)
  }
})

router.put('/', async (req, res, next) => {
  try {
    const parsed = settingsSchema.safeParse(req.body || {})
    if (!parsed.success) {
      const first = parsed.error.errors[0]
      return res.status(400).json({ success: false, message: first.message })
    }

    const {
      top_donors_limit,
      donor_threshold,
      opening_cash_balance,
      opening_bank_balance,
      name,
      name_hindi,
      address,
      phone,
      email,
      logo_url,
      receipt_prefix,
      current_fy,
      primary_color,
      secondary_color,
      pan_number,
      reg_number,
      bank_name,
      bank_account,
      bank_ifsc,
      settings_json,
    } = parsed.data
    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (name_hindi !== undefined) updateData.name_hindi = name_hindi
    if (address !== undefined) updateData.address = address
    if (phone !== undefined) updateData.phone = phone
    if (email !== undefined) updateData.email = email || null
    if (logo_url !== undefined) updateData.logo_url = logo_url || null
    if (receipt_prefix !== undefined) updateData.receipt_prefix = receipt_prefix
    if (current_fy !== undefined) updateData.current_fy = current_fy
    if (primary_color !== undefined) updateData.primary_color = primary_color
    if (secondary_color !== undefined) updateData.secondary_color = secondary_color
    if (pan_number !== undefined) updateData.pan_number = pan_number || null
    if (reg_number !== undefined) updateData.reg_number = reg_number || null
    if (bank_name !== undefined) updateData.bank_name = bank_name || null
    if (bank_account !== undefined) updateData.bank_account = bank_account || null
    if (bank_ifsc !== undefined) updateData.bank_ifsc = bank_ifsc || null
    if (top_donors_limit !== undefined) updateData.top_donors_limit = top_donors_limit
    if (donor_threshold !== undefined) updateData.donor_threshold = donor_threshold
    if (opening_cash_balance !== undefined) updateData.opening_cash_balance = opening_cash_balance
    if (opening_bank_balance !== undefined) updateData.opening_bank_balance = opening_bank_balance

    if (settings_json !== undefined) {
      const current = await prisma.trust.findFirst({
        where: { id: req.trustId },
        select: { settings_json: true },
      })
      updateData.settings_json = mergeSettingsJson(current?.settings_json || {}, settings_json)
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: 'No settings provided' })
    }

    const updated = await prisma.trust.updateMany({
      where: { id: req.trustId },
      data: updateData,
    })

    await createAuditLog({
      ...getAuditContext(req),
      module: 'SETTINGS',
      action: 'UPDATE',
      entity_type: 'Trust',
      entity_id: req.trustId,
      description: `Trust settings updated`,
      metadata: updateData,
    })

    const refreshed = await prisma.trust.findFirst({ where: { id: req.trustId } })

    return res.json({
      success: true,
      settings: {
        name: refreshed.name,
        name_hindi: refreshed.name_hindi,
        address: refreshed.address,
        phone: refreshed.phone,
        email: refreshed.email || '',
        logo_url: refreshed.logo_url || '',
        receipt_prefix: refreshed.receipt_prefix || 'TRUST',
        current_fy: refreshed.current_fy || '',
        primary_color: refreshed.primary_color || '#FF6B00',
        secondary_color: refreshed.secondary_color || '#7B1C1C',
        pan_number: refreshed.pan_number || '',
        reg_number: refreshed.reg_number || '',
        bank_name: refreshed.bank_name || '',
        bank_account: refreshed.bank_account || '',
        bank_ifsc: refreshed.bank_ifsc || '',
        settings_json: refreshed.settings_json || {},
        top_donors_limit: refreshed.top_donors_limit ?? 10,
        donor_threshold: refreshed.donor_threshold ?? 1100,
        opening_cash_balance: Number(refreshed.opening_cash_balance || 0),
        opening_bank_balance: Number(refreshed.opening_bank_balance || 0),
      },
      updateResult: { count: updated.count },
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router

