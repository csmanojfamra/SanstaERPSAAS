const prisma = require('../lib/prisma')

async function createNotification({
  trust_id,
  type,
  title,
  message,
  priority = 'MEDIUM',
}) {
  return prisma.notification.create({
    data: {
      trust_id,
      type,
      title,
      message,
      priority,
    },
  })
}

module.exports = {
  createNotification,
}
