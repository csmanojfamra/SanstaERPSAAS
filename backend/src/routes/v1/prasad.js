const router = require('express').Router()
const { z } = require('zod')
const { validate } = require('../../utils/validators')
const { createAuditLog } = require('../../services/audit.service')
const { getAuditContext } = require('../../utils/auditContext')
const { issuePrasadToken, listPrasadTokens, prasadAccount, resendPrasadWhatsApp } = require('../../services/prasadToken.service')

const issueSchema = z.object({
  donor_name: z.string().trim().min(2).max(200),
  donor_mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile'),
  amount: z.coerce.number().positive().max(10000000),
  rupees_per_packet: z.coerce.number().int().min(1).max(100000).optional(),
})

router.get('/account', async (req, res, next) => {
  try {
    const account = await prasadAccount(req.trustId, req.query)
    res.json({ success: true, account })
  } catch (err) {
    next(err)
  }
})

router.get('/', async (req, res, next) => {
  try {
    const result = await listPrasadTokens(req.trustId, req.query)
    res.json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
})

router.post('/:id/whatsapp', async (req, res, next) => {
  try {
    const result = await resendPrasadWhatsApp(req, req.params.id)
    if (!result) {
      return res.status(404).json({ success: false, message: 'Token not found' })
    }
    res.json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const data = validate(issueSchema, req.body)
    const result = await issuePrasadToken(req, data)
    await createAuditLog({
      ...getAuditContext(req),
      module: 'PRASAD',
      action: 'ISSUE',
      entity_type: 'PrasadToken',
      entity_id: result.token.id,
      description: `Prasad token for ${result.token.donor_name} — ${result.token.packets} packet`,
      metadata: {
        amount: result.token.amount,
        packets: result.token.packets,
        code: result.token.code,
      },
    })
    res.status(201).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
})

module.exports = router
