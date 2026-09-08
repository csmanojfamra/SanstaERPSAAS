/**
 * In-kind receipt numbers — call only inside prisma.$transaction.
 * Format: {prefix}-IK/{fy}/0001
 */
async function generateInKindReceiptNumber(trustId, tx) {
  const trust = await tx.trust.findUnique({
    where: { id: trustId },
    select: { receipt_prefix: true, current_fy: true },
  })
  if (!trust) throw new Error('Trust not found for in-kind receipt number')

  const pattern = `${trust.receipt_prefix}-IK/${trust.current_fy}/`
  const last = await tx.inKindReceipt.findFirst({
    where: { trust_id: trustId, receipt_number: { startsWith: pattern } },
    orderBy: { created_at: 'desc' },
    select: { receipt_number: true },
  })

  let nextSeq = 1
  if (last?.receipt_number) {
    const parts = last.receipt_number.split('/')
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    if (!Number.isNaN(lastSeq)) nextSeq = lastSeq + 1
  }
  return `${pattern}${String(nextSeq).padStart(4, '0')}`
}

module.exports = { generateInKindReceiptNumber }
