function getAuditContext(req) {
  return {
    trust_id: req.trustId,
    user_id: req.user?.id ?? null,
    ip_address: req.ip || req.socket?.remoteAddress || null,
    user_agent: req.headers['user-agent'] || null,
  }
}

module.exports = { getAuditContext }
