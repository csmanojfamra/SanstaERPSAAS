const router = require('express').Router()
const { searchDonors } = require('../../services/donor.service')

router.get('/', async (req, res, next) => {
  try {
    const donors = await searchDonors(req.trustId, req.query.q || req.query.search || '')
    res.json({ success: true, donors })
  } catch (err) {
    next(err)
  }
})

module.exports = router
