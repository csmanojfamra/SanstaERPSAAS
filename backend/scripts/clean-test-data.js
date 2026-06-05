/**
 * Removes all transactional / test data for the trust.
 * Preserves: Trust, users (admin, krishna, mandir_admin), seed trustee (trustee_001).
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const TRUST_ID = process.env.TRUST_ID || 'clsanwaliya001'
const KEEP_TRUSTEE_IDS = ['trustee_001']

async function main() {
  console.log('Cleaning test/dummy data for trust:', TRUST_ID)

  const summary = await prisma.$transaction(async (tx) => {
    const recon = await tx.reconciliationLog.deleteMany({ where: { trust_id: TRUST_ID } })
    const contribs = await tx.trusteeContribution.deleteMany({
      where: { trustee: { trust_id: TRUST_ID } },
    })
    const donations = await tx.donation.deleteMany({ where: { trust_id: TRUST_ID } })
    const expenses = await tx.expense.deleteMany({ where: { trust_id: TRUST_ID } })
    const audits = await tx.auditLog.deleteMany({ where: { trust_id: TRUST_ID } })
    const notifications = await tx.notification.deleteMany({ where: { trust_id: TRUST_ID } })
    const trustees = await tx.trustee.deleteMany({
      where: {
        trust_id: TRUST_ID,
        id: { notIn: KEEP_TRUSTEE_IDS },
      },
    })

    return { recon, contribs, donations, expenses, audits, notifications, trustees }
  })

  const receiptsDir = path.join(__dirname, '../uploads/receipts')
  let pdfsRemoved = 0
  if (fs.existsSync(receiptsDir)) {
    for (const file of fs.readdirSync(receiptsDir)) {
      if (file.endsWith('.pdf')) {
        fs.unlinkSync(path.join(receiptsDir, file))
        pdfsRemoved++
      }
    }
  }

  console.log('\nDeleted:')
  console.log('  Reconciliation logs:', summary.recon.count)
  console.log('  Trustee contributions:', summary.contribs.count)
  console.log('  Donations:', summary.donations.count)
  console.log('  Expenses:', summary.expenses.count)
  console.log('  Audit logs:', summary.audits.count)
  console.log('  Notifications:', summary.notifications.count)
  console.log('  Extra trustees:', summary.trustees.count)
  console.log('  Receipt PDF files:', pdfsRemoved)
  console.log('\nKept: trust, users (admin, krishna, mandir_admin), trustee_001')
  console.log('Next donation receipt will start at SSSM/2025-26/0001')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
