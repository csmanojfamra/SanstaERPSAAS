const prisma = require('../lib/prisma')

async function createAuditLog({
  trust_id,
  user_id,
  module,
  action,
  entity_type,
  entity_id,
  description,
  metadata,
  ip_address,
  user_agent,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        trust_id,
        user_id: user_id || null,
        module,
        action,
        entity_type,
        entity_id: entity_id || null,
        description,
        metadata: metadata || undefined,
        ip_address: ip_address || null,
        user_agent: user_agent || null,
      },
    })
  } catch (err) {
    console.error('Audit log failed:', err.message)
  }
}

module.exports = {
  createAuditLog,
}
