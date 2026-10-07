const { findTokenByCode, redeemPrasadToken } = require('../services/prasadToken.service')
const { renderPrasadPage, renderMissing } = require('../services/prasadPage')
const { createAuditLog } = require('../services/audit.service')

const CODE = /^[A-Za-z0-9_-]{16,40}$/

function mountPrasadPublic(app) {
  app.get('/p/:code', async (req, res, next) => {
    try {
      if (!CODE.test(req.params.code)) {
        res.status(404).type('html').send(renderMissing())
        return
      }
      const token = await findTokenByCode(req.params.code)
      if (!token) {
        res.status(404).type('html').send(renderMissing())
        return
      }
      res.set('Cache-Control', 'no-store')
      res.type('html').send(renderPrasadPage(token))
    } catch (err) {
      next(err)
    }
  })

  app.post('/p/:code/redeem', async (req, res, next) => {
    try {
      if (!CODE.test(req.params.code)) {
        res.redirect(303, `/p/${encodeURIComponent(req.params.code)}`)
        return
      }
      const redeemed = await redeemPrasadToken(req.params.code)
      if (redeemed) {
        const token = await findTokenByCode(req.params.code)
        if (token) {
          await createAuditLog({
            trust_id: token.trust_id,
            module: 'PRASAD',
            action: 'REDEEM',
            entity_type: 'PrasadToken',
            entity_id: token.id,
            description: `Prasad token used for ${token.donor_name}`,
            ip_address: req.ip,
            user_agent: req.get('user-agent'),
          })
        }
      }
      res.redirect(303, `/p/${encodeURIComponent(req.params.code)}`)
    } catch (err) {
      next(err)
    }
  })
}

module.exports = { mountPrasadPublic }
