const router = require('express').Router()
const authMiddleware = require('../../../src/middleware/auth')
const tenantResolver = require('../../../src/middleware/tenantResolver')
const requireAdmin = require('../../../src/middleware/requireAdmin')

const requirePlatformAdmin = require('../../../src/middleware/requirePlatformAdmin')

const protect = [authMiddleware, tenantResolver]
const adminOnly = [authMiddleware, tenantResolver, requireAdmin]
const platformOnly = [authMiddleware, requirePlatformAdmin]

router.use('/auth', require('./auth'))
router.use('/platform', platformOnly, require('./platform'))
router.use('/donations', protect, require('./donations'))
router.use('/trustees', protect, require('./trustees'))
router.use('/expenses', protect, require('./expenses'))
router.use('/vendors', protect, require('./vendors'))
router.use('/reports', protect, require('./reports'))
router.use('/analytics', protect, require('./analytics'))
router.use('/cashbook', adminOnly, require('./cashbook'))
router.use('/settings', adminOnly, require('./settings'))
router.use('/users', adminOnly, require('./users'))
router.use('/public', require('./public'))

module.exports = router

