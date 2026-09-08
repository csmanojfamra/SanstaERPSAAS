const prisma = require('../lib/prisma')

async function getStockBalance(trustId, stockItemId, tx = prisma) {
  const rows = await tx.stockMovement.groupBy({
    by: ['movement_type'],
    where: { trust_id: trustId, stock_item_id: stockItemId },
    _sum: { quantity: true },
  })
  let inbound = 0
  let utilised = 0
  for (const row of rows) {
    const qty = Number(row._sum.quantity || 0)
    if (row.movement_type === 'IN') inbound += qty
    if (row.movement_type === 'UTILISE') utilised += qty
  }
  return {
    inbound,
    utilised,
    balance: inbound - utilised,
  }
}

async function getBalancesForTrust(trustId, itemIds = null) {
  const where = { trust_id: trustId }
  if (itemIds?.length) where.stock_item_id = { in: itemIds }

  const rows = await prisma.stockMovement.groupBy({
    by: ['stock_item_id', 'movement_type'],
    where,
    _sum: { quantity: true },
  })

  const map = {}
  for (const row of rows) {
    if (!map[row.stock_item_id]) {
      map[row.stock_item_id] = { inbound: 0, utilised: 0, balance: 0 }
    }
    const qty = Number(row._sum.quantity || 0)
    if (row.movement_type === 'IN') map[row.stock_item_id].inbound += qty
    if (row.movement_type === 'UTILISE') map[row.stock_item_id].utilised += qty
  }
  for (const id of Object.keys(map)) {
    map[id].balance = map[id].inbound - map[id].utilised
  }
  return map
}

module.exports = { getStockBalance, getBalancesForTrust }
