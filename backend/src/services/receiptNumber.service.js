/**
 * Receipt number generation — MUST only be called inside prisma.$transaction.
 */

const generateReceiptNumber = async (trustId, tx) => {
  const trust = await tx.trust.findUnique({
    where: { id: trustId },
    select: { receipt_prefix: true, current_fy: true },
  })

  if (!trust) {
    throw new Error('Trust not found for receipt number generation')
  }

  const prefix = trust.receipt_prefix
  const fy = trust.current_fy
  const pattern = `${prefix}/${fy}/`

  // Include soft-deleted rows so sequence never reuses a receipt number (unique constraint)
  const last = await tx.donation.findFirst({
    where: {
      trust_id: trustId,
      receipt_number: { startsWith: pattern },
    },
    orderBy: { created_at: 'desc' },
    select: { receipt_number: true },
  })

  let nextSeq = 1
  if (last) {
    const parts = last.receipt_number.split('/')
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    if (!Number.isNaN(lastSeq)) {
      nextSeq = lastSeq + 1
    }
  }

  const padded = String(nextSeq).padStart(4, '0')
  return `${pattern}${padded}`
}

module.exports = { generateReceiptNumber }
