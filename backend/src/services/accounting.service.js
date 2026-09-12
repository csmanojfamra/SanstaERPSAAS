const prismaClient = require('../lib/prisma')
const logger = require('../utils/logger')

const DEFAULT_ACCOUNTS = [
  // ASSETS (1xxx)
  { code: '1001', name: 'Cash in Hand (नकद कोष)', account_type: 'ASSET', normal_balance: 'DEBIT', is_system: true },
  { code: '1002', name: 'Bank Account (मुख्य बैंक खाता)', account_type: 'ASSET', normal_balance: 'DEBIT', is_system: true },
  { code: '1101', name: 'Temple Property & Building WIP (मंदिर भवन व निर्माण कार्य)', account_type: 'ASSET', normal_balance: 'DEBIT', is_system: true },
  { code: '1102', name: 'Furniture, Fixtures & Equipment (फर्नीचर व उपकरण)', account_type: 'ASSET', normal_balance: 'DEBIT', is_system: true },
  { code: '1201', name: 'Fixed Deposits with Bank (सावधि जमा / FD)', account_type: 'ASSET', normal_balance: 'DEBIT', is_system: true },

  // LIABILITIES (2xxx)
  { code: '2001', name: 'Sundry Creditors & Vendors (लेनदार / वेंडर्स देयता)', account_type: 'LIABILITY', normal_balance: 'CREDIT', is_system: true },
  { code: '2002', name: 'Statutory Dues & TDS Payable (वैधानिक देयताएं)', account_type: 'LIABILITY', normal_balance: 'CREDIT', is_system: true },
  { code: '2003', name: 'Security Deposits & Advances (सुरक्षा जमा व अग्रिम)', account_type: 'LIABILITY', normal_balance: 'CREDIT', is_system: true },

  // CORPUS & RESERVES (3xxx)
  { code: '3001', name: 'Corpus Fund / Pujya Nidhi (स्थायी निधि / पूज्य निधि)', account_type: 'CORPUS', normal_balance: 'CREDIT', is_system: true },
  { code: '3002', name: 'Accumulated Surplus / (Deficit) (संचित अधिशेष / घाटा)', account_type: 'LIABILITY', normal_balance: 'CREDIT', is_system: true },
  { code: '3003', name: 'Temple Construction & Earmarked Fund (मंदिर निर्माण विशेष निधि)', account_type: 'CORPUS', normal_balance: 'CREDIT', is_system: true },

  // INCOME (4xxx)
  { code: '4001', name: 'General Donations (सामान्य दान / दान-पात्र)', account_type: 'INCOME', normal_balance: 'CREDIT', is_system: true },
  { code: '4002', name: 'Prasad & Bhog Sewa (भोग सेवा)', account_type: 'INCOME', normal_balance: 'CREDIT', is_system: false },
  { code: '4003', name: 'Utsav & Festival Collections (उत्सव / मेला दान)', account_type: 'INCOME', normal_balance: 'CREDIT', is_system: false },
  { code: '4004', name: 'Bank Interest Received (बैंक ब्याज आय)', account_type: 'INCOME', normal_balance: 'CREDIT', is_system: true },
  { code: '4005', name: 'Membership Subscriptions (आजीवन / वार्षिक सदस्यता)', account_type: 'INCOME', normal_balance: 'CREDIT', is_system: false },
  { code: '4099', name: 'Miscellaneous Receipts (अन्य प्राप्तियां)', account_type: 'INCOME', normal_balance: 'CREDIT', is_system: false },

  // EXPENSES (5xxx)
  { code: '5001', name: 'Labour & Construction (श्रम एवं निर्माण व्यय)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'LABOUR_CONSTRUCTION' },
  { code: '5002', name: 'Religious & Puja Activities (धार्मिक व पूजा व्यय)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'RELIGIOUS_ACTIVITIES' },
  { code: '5003', name: 'Temple Maintenance & Repairs (मंदिर रखरखाव व मरम्मत)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'TEMPLE_MAINTENANCE' },
  { code: '5004', name: 'Utilities & Electricity (बिजली एवं जल व्यय)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'UTILITIES' },
  { code: '5005', name: 'Prasad & Food Distribution (प्रसाद एवं भंडारा वितरण)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'PRASAD_FOOD_DISTRIBUTION' },
  { code: '5006', name: 'Festival & Utsav Expenses (उत्सव एवं पर्व आयोजन व्यय)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'FESTIVAL_EXPENSES' },
  { code: '5007', name: 'Administrative & Office Expenses (प्रशासनिक एवं कार्यालय व्यय)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'ADMINISTRATIVE_EXPENSES' },
  { code: '5008', name: 'Salary & Staff Wages (वेतन एवं मानदेय)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'SALARY_WAGES' },
  { code: '5009', name: 'Legal & Professional Fees (कानूनी व पेशेवर शुल्क)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'LEGAL_PROFESSIONAL' },
  { code: '5010', name: 'Charity & Public Relief (दान एवं जन सहायता)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'CHARITY_RELIEF' },
  { code: '5011', name: 'Bank Charges (बैंक प्रभार)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'BANK_CHARGES' },
  { code: '5012', name: 'Construction (निर्माण)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'CONSTRUCTION' },
  { code: '5013', name: 'Materials & Supplies (सामग्री व्यय)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'MATERIALS' },
  { code: '5014', name: 'Labour Wages (मजदूरी)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'LABOUR' },
  { code: '5015', name: 'Puja Expenses (पूजा सामग्री)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'PUJA' },
  { code: '5016', name: 'Admin Overhead (सामान्य प्रशासनिक व्यय)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'ADMIN' },
  { code: '5017', name: 'Travel & Transport (यात्रा एवं परिवहन)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'TRAVEL' },
  { code: '5018', name: 'Food & Catering (अन्नक्षेत्र व्यय)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'FOOD' },
  { code: '5099', name: 'Other Miscellaneous Expenses (अन्य विविध व्यय)', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, expense_category: 'OTHER' },
]

function getFYFromDate(dateInput) {
  const d = new Date(dateInput)
  if (Number.isNaN(d.getTime())) {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    return m >= 4 ? `${y}-${String((y + 1) % 100).padStart(2, '0')}` : `${y - 1}-${String(y % 100).padStart(2, '0')}`
  }
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  if (month >= 4) {
    const nextYear2Digits = String((year + 1) % 100).padStart(2, '0')
    return `${year}-${nextYear2Digits}`
  }
  const year2Digits = String(year % 100).padStart(2, '0')
  return `${year - 1}-${year2Digits}`
}

function getFYDateRange(fyString) {
  if (!fyString || !/^\d{4}-\d{2}$/.test(fyString)) {
    const nowFY = getFYFromDate(new Date())
    const startY = parseInt(nowFY.split('-')[0], 10)
    return {
      from: new Date(Date.UTC(startY, 3, 1, 0, 0, 0)),
      to: new Date(Date.UTC(startY + 1, 2, 31, 23, 59, 59, 999)),
    }
  }
  const startYear = parseInt(fyString.split('-')[0], 10)
  return {
    from: new Date(Date.UTC(startYear, 3, 1, 0, 0, 0)),
    to: new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999)),
  }
}

/**
 * Ensures standard Chart of Accounts exist for a given trust.
 */
async function ensureDefaultAccounts(trustId, tx = prismaClient) {
  const existing = await tx.account.findMany({
    where: { trust_id: trustId },
    select: { code: true },
  })
  const existingCodes = new Set(existing.map((a) => a.code))

  const toCreate = DEFAULT_ACCOUNTS.filter((acc) => !existingCodes.has(acc.code))
  for (const acc of toCreate) {
    await tx.account.create({
      data: {
        trust_id: trustId,
        code: acc.code,
        name: acc.name,
        account_type: acc.account_type,
        normal_balance: acc.normal_balance,
        is_system: acc.is_system,
        expense_category: acc.expense_category || null,
        purpose_key: null,
      },
    })
  }

  return tx.account.findMany({
    where: { trust_id: trustId },
    orderBy: { code: 'asc' },
  })
}

/**
 * Looks up or auto-creates an account for a donation purpose.
 */
async function ensurePurposeAccount(trustId, purpose, isCorpus = false, tx = prismaClient) {
  await ensureDefaultAccounts(trustId, tx)

  if (isCorpus) {
    const corpusAcc = await tx.account.findUnique({
      where: { trust_id_code: { trust_id: trustId, code: '3001' } },
    })
    if (corpusAcc) return corpusAcc
  }

  const p = String(purpose || '').trim()
  if (!p) {
    return tx.account.findUnique({
      where: { trust_id_code: { trust_id: trustId, code: '4001' } },
    })
  }

  const lower = p.toLowerCase()
  if (lower.includes('prasad') || lower.includes('bhog')) {
    const acc = await tx.account.findUnique({ where: { trust_id_code: { trust_id: trustId, code: '4002' } } })
    if (acc) return acc
  }
  if (lower.includes('utsav') || lower.includes('festival') || lower.includes('mela') || lower.includes('diwali') || lower.includes('navratri') || lower.includes('janmashtami')) {
    const acc = await tx.account.findUnique({ where: { trust_id_code: { trust_id: trustId, code: '4003' } } })
    if (acc) return acc
  }
  if (lower.includes('interest') || lower.includes('byaj')) {
    const acc = await tx.account.findUnique({ where: { trust_id_code: { trust_id: trustId, code: '4004' } } })
    if (acc) return acc
  }
  if (lower.includes('member') || lower.includes('sadasya') || lower.includes('patron')) {
    const acc = await tx.account.findUnique({ where: { trust_id_code: { trust_id: trustId, code: '4005' } } })
    if (acc) return acc
  }

  const normalizedKey = lower.replace(/[^a-z0-9]+/g, '_').slice(0, 40)
  let customAcc = await tx.account.findFirst({
    where: {
      trust_id: trustId,
      OR: [
        { purpose_key: normalizedKey },
        { name: { equals: p, mode: 'insensitive' } },
      ],
    },
  })
  if (customAcc) return customAcc

  // Find next available code in 40xx range
  const incomeAccounts = await tx.account.findMany({
    where: { trust_id: trustId, account_type: 'INCOME' },
    select: { code: true },
  })
  const usedCodes = new Set(incomeAccounts.map((a) => parseInt(a.code, 10)).filter((n) => !Number.isNaN(n)))
  let nextCodeNum = 4010
  while (usedCodes.has(nextCodeNum) && nextCodeNum < 4099) {
    nextCodeNum++
  }
  if (nextCodeNum >= 4099) {
    return tx.account.findUnique({ where: { trust_id_code: { trust_id: trustId, code: '4001' } } })
  }

  const newCode = String(nextCodeNum)
  customAcc = await tx.account.create({
    data: {
      trust_id: trustId,
      code: newCode,
      name: `${p} (दान आय)`,
      account_type: 'INCOME',
      normal_balance: 'CREDIT',
      is_system: false,
      purpose_key: normalizedKey,
    },
  })
  return customAcc
}

/**
 * Returns matching expense account for an expense category.
 */
async function ensureExpenseAccount(trustId, category, tx = prismaClient) {
  await ensureDefaultAccounts(trustId, tx)

  if (category) {
    const acc = await tx.account.findFirst({
      where: {
        trust_id: trustId,
        expense_category: String(category).trim(),
      },
    })
    if (acc) return acc
  }

  const fallback = await tx.account.findUnique({
    where: { trust_id_code: { trust_id: trustId, code: '5099' } },
  })
  return fallback || tx.account.findFirst({ where: { trust_id: trustId, account_type: 'EXPENSE' } })
}

/**
 * Generates an auto-incrementing journal voucher number.
 */
async function generateJournalEntryNumber(trustId, voucherType, entryDate, tx = prismaClient) {
  const fy = getFYFromDate(entryDate)
  let prefix = 'JV'
  if (voucherType === 'RECEIPT') prefix = 'REC-JV'
  else if (voucherType === 'PAYMENT') prefix = 'PAY-JV'
  else if (voucherType === 'OPENING') prefix = 'OPN-JV'
  else if (voucherType === 'CONTRA') prefix = 'CON-JV'

  const pattern = `${prefix}/${fy}/`
  const last = await tx.journalEntry.findFirst({
    where: {
      trust_id: trustId,
      entry_number: { startsWith: pattern },
    },
    orderBy: { created_at: 'desc' },
    select: { entry_number: true },
  })

  let nextSeq = 1
  if (last) {
    const parts = last.entry_number.split('/')
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    if (!Number.isNaN(lastSeq)) nextSeq = lastSeq + 1
  }

  return `${pattern}${String(nextSeq).padStart(4, '0')}`
}

/**
 * Creates a balanced Journal Entry with lines.
 */
async function createJournalEntry({
  trustId,
  entryDate,
  voucherType = 'JOURNAL',
  narration = '',
  sourceType = 'MANUAL',
  sourceId = null,
  createdBy = 'SYSTEM',
  lines = [],
}, tx = prismaClient) {
  if (!lines || lines.length < 2) {
    throw new Error('A journal entry must contain at least 2 lines (Debit and Credit).')
  }

  let totalDebit = 0
  let totalCredit = 0
  for (const line of lines) {
    const dr = Math.round((parseFloat(line.debit) || 0) * 100) / 100
    const cr = Math.round((parseFloat(line.credit) || 0) * 100) / 100
    totalDebit += dr
    totalCredit += cr
  }

  const diff = Math.abs(totalDebit - totalCredit)
  if (diff > 0.05) {
    throw new Error(`Journal entry is unbalanced: Total Debit ₹${totalDebit.toFixed(2)} != Total Credit ₹${totalCredit.toFixed(2)}`)
  }

  const dateObj = new Date(entryDate)
  const fy = getFYFromDate(dateObj)
  const entry_number = await generateJournalEntryNumber(trustId, voucherType, dateObj, tx)

  return tx.journalEntry.create({
    data: {
      trust_id: trustId,
      entry_number,
      entry_date: dateObj,
      voucher_type: voucherType,
      narration,
      source_type: sourceType,
      source_id: sourceId ? String(sourceId) : null,
      fy,
      created_by: createdBy,
      lines: {
        create: lines.map((l) => ({
          account_id: l.account_id,
          debit: Math.round((parseFloat(l.debit) || 0) * 100) / 100,
          credit: Math.round((parseFloat(l.credit) || 0) * 100) / 100,
          narration: l.narration || narration || null,
        })),
      },
    },
    include: {
      lines: {
        include: {
          account: true,
        },
      },
    },
  })
}

/**
 * Automatically posts a journal entry for a created donation receipt.
 * Dr Cash (1001) or Bank (1002)
 * Cr Purpose Income Account (4xxx) or Corpus Fund (3001)
 */
async function postDonationJournal(donation, createdBy = 'SYSTEM', tx = prismaClient) {
  if (!donation || !donation.id || !donation.trust_id) return null

  // Idempotency: skip if already posted
  const existing = await tx.journalEntry.findFirst({
    where: {
      trust_id: donation.trust_id,
      source_type: 'DONATION',
      source_id: donation.id,
      is_reversed: false,
    },
  })
  if (existing) return existing

  await ensureDefaultAccounts(donation.trust_id, tx)

  const isCash = (donation.payment_mode || 'CASH').toUpperCase() === 'CASH'
  const cashOrBankCode = isCash ? '1001' : '1002'
  const debitAccount = await tx.account.findUnique({
    where: { trust_id_code: { trust_id: donation.trust_id, code: cashOrBankCode } },
  })

  const creditAccount = await ensurePurposeAccount(donation.trust_id, donation.purpose, donation.is_corpus, tx)

  if (!debitAccount || !creditAccount) {
    logger.warn('Could not resolve debit or credit account for donation journal', { donationId: donation.id })
    return null
  }

  const amt = Number(donation.amount)
  const narration = `Donation receipt ${donation.receipt_number} from ${donation.donor_name}${donation.purpose ? ' for ' + donation.purpose : ''}`

  return createJournalEntry({
    trustId: donation.trust_id,
    entryDate: donation.donation_date || new Date(),
    voucherType: 'RECEIPT',
    narration,
    sourceType: 'DONATION',
    sourceId: donation.id,
    createdBy,
    lines: [
      {
        account_id: debitAccount.id,
        debit: amt,
        credit: 0,
        narration: `Receipt via ${donation.payment_mode || 'CASH'}`,
      },
      {
        account_id: creditAccount.id,
        debit: 0,
        credit: amt,
        narration: `Donation from ${donation.donor_name}`,
      },
    ],
  }, tx)
}

/**
 * Reverses a donation journal entry when a donation is soft-deleted.
 */
async function reverseDonationJournal(donation, createdBy = 'SYSTEM', tx = prismaClient) {
  if (!donation || !donation.id || !donation.trust_id) return null

  const original = await tx.journalEntry.findFirst({
    where: {
      trust_id: donation.trust_id,
      source_type: 'DONATION',
      source_id: donation.id,
      is_reversed: false,
    },
    include: { lines: true },
  })

  if (!original) return null

  // Create reversal with Dr and Cr swapped
  const reversalLines = original.lines.map((l) => ({
    account_id: l.account_id,
    debit: Number(l.credit),
    credit: Number(l.debit),
    narration: `Reversal of ${original.entry_number}: ${l.narration || ''}`,
  }))

  const reversal = await createJournalEntry({
    trustId: donation.trust_id,
    entryDate: new Date(),
    voucherType: 'RECEIPT',
    narration: `Reversal of receipt ${donation.receipt_number || original.entry_number} (Cancelled)`,
    sourceType: 'REVERSAL',
    sourceId: original.id,
    createdBy,
    lines: reversalLines,
  }, tx)

  await tx.journalEntry.update({
    where: { id: original.id },
    data: {
      is_reversed: true,
      reversed_by_id: reversal.id,
    },
  })

  return reversal
}

/**
 * Automatically posts a journal entry for an expense voucher.
 * Dr Expense Account (5xxx)
 * Cr Cash (1001) or Bank (1002)
 */
async function postExpenseJournal(expense, createdBy = 'SYSTEM', tx = prismaClient) {
  if (!expense || !expense.id || !expense.trust_id) return null

  // Idempotency: skip if already posted
  const existing = await tx.journalEntry.findFirst({
    where: {
      trust_id: expense.trust_id,
      source_type: 'EXPENSE',
      source_id: expense.id,
      is_reversed: false,
    },
  })
  if (existing) return existing

  await ensureDefaultAccounts(expense.trust_id, tx)

  const isCash = (expense.payment_channel || expense.payment_mode || 'CASH').toUpperCase() === 'CASH'
  const cashOrBankCode = isCash ? '1001' : '1002'
  const creditAccount = await tx.account.findUnique({
    where: { trust_id_code: { trust_id: expense.trust_id, code: cashOrBankCode } },
  })

  const debitAccount = await ensureExpenseAccount(expense.trust_id, expense.category, tx)

  if (!debitAccount || !creditAccount) {
    logger.warn('Could not resolve accounts for expense journal', { expenseId: expense.id })
    return null
  }

  const amt = Number(expense.amount)
  const narration = `Expense voucher ${expense.voucher_number || ''}: ${expense.description || ''}${expense.paid_to ? ' (Paid to ' + expense.paid_to + ')' : ''}`

  return createJournalEntry({
    trustId: expense.trust_id,
    entryDate: expense.expense_date || new Date(),
    voucherType: 'PAYMENT',
    narration,
    sourceType: 'EXPENSE',
    sourceId: expense.id,
    createdBy,
    lines: [
      {
        account_id: debitAccount.id,
        debit: amt,
        credit: 0,
        narration: expense.description || 'Expense payment',
      },
      {
        account_id: creditAccount.id,
        debit: 0,
        credit: amt,
        narration: `Paid via ${expense.payment_mode || 'CASH'}`,
      },
    ],
  }, tx)
}

/**
 * Reverses an expense journal entry when an expense is deleted.
 */
async function reverseExpenseJournal(expense, createdBy = 'SYSTEM', tx = prismaClient) {
  if (!expense || !expense.id || !expense.trust_id) return null

  const original = await tx.journalEntry.findFirst({
    where: {
      trust_id: expense.trust_id,
      source_type: 'EXPENSE',
      source_id: expense.id,
      is_reversed: false,
    },
    include: { lines: true },
  })

  if (!original) return null

  const reversalLines = original.lines.map((l) => ({
    account_id: l.account_id,
    debit: Number(l.credit),
    credit: Number(l.debit),
    narration: `Reversal of ${original.entry_number}: ${l.narration || ''}`,
  }))

  const reversal = await createJournalEntry({
    trustId: expense.trust_id,
    entryDate: new Date(),
    voucherType: 'PAYMENT',
    narration: `Reversal of expense ${expense.voucher_number || original.entry_number} (Cancelled)`,
    sourceType: 'REVERSAL',
    sourceId: original.id,
    createdBy,
    lines: reversalLines,
  }, tx)

  await tx.journalEntry.update({
    where: { id: original.id },
    data: {
      is_reversed: true,
      reversed_by_id: reversal.id,
    },
  })

  return reversal
}

/**
 * Posts opening balances from trust settings into double-entry accounting.
 * Dr Cash in Hand (1001)
 * Dr Bank Account (1002)
 * Cr Accumulated Surplus (3002)
 */
async function postOpeningBalances(trustId, fy, createdBy = 'SYSTEM', tx = prismaClient) {
  await ensureDefaultAccounts(trustId, tx)

  const trust = await tx.trust.findUnique({
    where: { id: trustId },
    select: { opening_cash_balance: true, opening_bank_balance: true, current_fy: true },
  })
  if (!trust) return null

  const activeFY = fy || trust.current_fy || getFYFromDate(new Date())
  const existing = await tx.journalEntry.findFirst({
    where: {
      trust_id: trustId,
      source_type: 'OPENING',
      fy: activeFY,
      is_reversed: false,
    },
  })
  const cashBal = Number(trust.opening_cash_balance) || 0
  const bankBal = Number(trust.opening_bank_balance) || 0
  const totalOpening = cashBal + bankBal

  if (existing) {
    const currentLines = await tx.journalLine.findMany({
      where: { journal_entry_id: existing.id },
      include: { account: true },
    })
    const existingCash = Number(currentLines.find((l) => l.account?.code === '1001')?.debit || 0)
    const existingBank = Number(currentLines.find((l) => l.account?.code === '1002')?.debit || 0)

    if (existingCash === cashBal && existingBank === bankBal) {
      return existing
    }

    await tx.journalEntry.update({
      where: { id: existing.id },
      data: { is_reversed: true },
    })
  }

  if (totalOpening <= 0) return null

  const cashAcc = await tx.account.findUnique({ where: { trust_id_code: { trust_id: trustId, code: '1001' } } })
  const bankAcc = await tx.account.findUnique({ where: { trust_id_code: { trust_id: trustId, code: '1002' } } })
  const surplusAcc = await tx.account.findUnique({ where: { trust_id_code: { trust_id: trustId, code: '3002' } } })

  const lines = []
  if (cashBal > 0) lines.push({ account_id: cashAcc.id, debit: cashBal, credit: 0, narration: 'Opening Cash in Hand' })
  if (bankBal > 0) lines.push({ account_id: bankAcc.id, debit: bankBal, credit: 0, narration: 'Opening Bank Balance' })
  lines.push({ account_id: surplusAcc.id, debit: 0, credit: totalOpening, narration: 'Opening Accumulated Surplus' })

  const fyRange = getFYDateRange(activeFY)
  return createJournalEntry({
    trustId,
    entryDate: fyRange.from,
    voucherType: 'OPENING',
    narration: `Opening balance for FY ${activeFY}`,
    sourceType: 'OPENING',
    sourceId: `OPENING_${activeFY}`,
    createdBy,
    lines,
  }, tx)
}

/**
 * Backfills double-entry journal entries for existing donations and expenses for current FY.
 */
async function backfillCurrentFY(trustId, createdBy = 'ADMIN', tx = prismaClient) {
  await ensureDefaultAccounts(trustId, tx)

  const trust = await tx.trust.findUnique({
    where: { id: trustId },
    select: { current_fy: true },
  })
  const fy = trust?.current_fy || getFYFromDate(new Date())
  const { from, to } = getFYDateRange(fy)

  // 1. Opening balance
  await postOpeningBalances(trustId, fy, createdBy, tx)

  // 2. Unposted Donations
  const donations = await tx.donation.findMany({
    where: {
      trust_id: trustId,
      is_deleted: false,
      donation_date: { gte: from, lte: to },
    },
    orderBy: { donation_date: 'asc' },
  })

  let donationsPosted = 0
  for (const d of donations) {
    const posted = await postDonationJournal(d, createdBy, tx)
    if (posted) donationsPosted++
  }

  // 3. Unposted Expenses
  const expenses = await tx.expense.findMany({
    where: {
      trust_id: trustId,
      expense_date: { gte: from, lte: to },
    },
    orderBy: { expense_date: 'asc' },
  })

  let expensesPosted = 0
  for (const e of expenses) {
    const posted = await postExpenseJournal(e, createdBy, tx)
    if (posted) expensesPosted++
  }

  return { fy, donationsPosted, expensesPosted }
}

/**
 * Generates the Trial Balance for a period / FY.
 */
async function getTrialBalance(trustId, { fromDate, toDate, fy } = {}, tx = prismaClient) {
  await ensureDefaultAccounts(trustId, tx)

  let dateFilter = {}
  if (fromDate || toDate) {
    dateFilter.entry_date = {}
    if (fromDate) dateFilter.entry_date.gte = new Date(fromDate)
    if (toDate) dateFilter.entry_date.lte = new Date(toDate)
  } else if (fy) {
    const range = getFYDateRange(fy)
    dateFilter.entry_date = { gte: range.from, lte: range.to }
  }

  const accounts = await tx.account.findMany({
    where: { trust_id: trustId, is_active: true },
    orderBy: { code: 'asc' },
  })

  const lines = await tx.journalLine.findMany({
    where: {
      account: { trust_id: trustId },
      journal_entry: {
        trust_id: trustId,
        is_reversed: false,
        ...dateFilter,
      },
    },
    select: {
      account_id: true,
      debit: true,
      credit: true,
    },
  })

  const lineMap = new Map()
  for (const l of lines) {
    const curr = lineMap.get(l.account_id) || { totalDebit: 0, totalCredit: 0 }
    curr.totalDebit += Number(l.debit) || 0
    curr.totalCredit += Number(l.credit) || 0
    lineMap.set(l.account_id, curr)
  }

  let grandDebit = 0
  let grandCredit = 0
  let grandNetDebit = 0
  let grandNetCredit = 0

  const rows = accounts.map((acc) => {
    const totals = lineMap.get(acc.id) || { totalDebit: 0, totalCredit: 0 }
    const totalDebit = Math.round(totals.totalDebit * 100) / 100
    const totalCredit = Math.round(totals.totalCredit * 100) / 100

    grandDebit += totalDebit
    grandCredit += totalCredit

    const net = totalDebit - totalCredit
    let netDebit = 0
    let netCredit = 0
    if (net > 0) netDebit = net
    else if (net < 0) netCredit = Math.abs(net)

    grandNetDebit += netDebit
    grandNetCredit += netCredit

    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      account_type: acc.account_type,
      normal_balance: acc.normal_balance,
      period_debit: totalDebit,
      period_credit: totalCredit,
      net_debit: Math.round(netDebit * 100) / 100,
      net_credit: Math.round(netCredit * 100) / 100,
    }
  }).filter((r) => r.period_debit > 0 || r.period_credit > 0)

  return {
    rows,
    totals: {
      period_debit: Math.round(grandDebit * 100) / 100,
      period_credit: Math.round(grandCredit * 100) / 100,
      net_debit: Math.round(grandNetDebit * 100) / 100,
      net_credit: Math.round(grandNetCredit * 100) / 100,
      is_balanced: Math.abs(grandDebit - grandCredit) < 0.05,
    },
  }
}

/**
 * Generates the Income & Expenditure Account.
 * Format for Trusts:
 * Income (Credit) vs Expenditure (Debit) -> Surplus / (Deficit) carried to Balance Sheet
 */
async function getIncomeAndExpenditure(trustId, { fromDate, toDate, fy } = {}, tx = prismaClient) {
  await ensureDefaultAccounts(trustId, tx)

  let dateFilter = {}
  if (fromDate || toDate) {
    dateFilter.entry_date = {}
    if (fromDate) dateFilter.entry_date.gte = new Date(fromDate)
    if (toDate) dateFilter.entry_date.lte = new Date(toDate)
  } else if (fy) {
    const range = getFYDateRange(fy)
    dateFilter.entry_date = { gte: range.from, lte: range.to }
  }

  const accounts = await tx.account.findMany({
    where: {
      trust_id: trustId,
      account_type: { in: ['INCOME', 'EXPENSE'] },
      is_active: true,
    },
    orderBy: { code: 'asc' },
  })

  const lines = await tx.journalLine.findMany({
    where: {
      account: { trust_id: trustId, account_type: { in: ['INCOME', 'EXPENSE'] } },
      journal_entry: {
        trust_id: trustId,
        is_reversed: false,
        ...dateFilter,
      },
    },
    select: {
      account_id: true,
      debit: true,
      credit: true,
    },
  })

  const lineMap = new Map()
  for (const l of lines) {
    const curr = lineMap.get(l.account_id) || { debit: 0, credit: 0 }
    curr.debit += Number(l.debit) || 0
    curr.credit += Number(l.credit) || 0
    lineMap.set(l.account_id, curr)
  }

  const incomeItems = []
  const expenditureItems = []
  let totalIncome = 0
  let totalExpenditure = 0

  for (const acc of accounts) {
    const entry = lineMap.get(acc.id) || { debit: 0, credit: 0 }
    if (acc.account_type === 'INCOME') {
      // Income net is Cr - Dr
      const amount = Math.round((entry.credit - entry.debit) * 100) / 100
      if (amount !== 0) {
        incomeItems.push({ code: acc.code, name: acc.name, amount })
        totalIncome += amount
      }
    } else {
      // Expense net is Dr - Cr
      const amount = Math.round((entry.debit - entry.credit) * 100) / 100
      if (amount !== 0) {
        expenditureItems.push({ code: acc.code, name: acc.name, category: acc.expense_category, amount })
        totalExpenditure += amount
      }
    }
  }

  totalIncome = Math.round(totalIncome * 100) / 100
  totalExpenditure = Math.round(totalExpenditure * 100) / 100
  const surplus = Math.round((totalIncome - totalExpenditure) * 100) / 100

  return {
    income: incomeItems,
    expenditure: expenditureItems,
    total_income: totalIncome,
    total_expenditure: totalExpenditure,
    surplus_or_deficit: surplus,
    is_surplus: surplus >= 0,
  }
}

/**
 * Generates Statement of Affairs (Balance Sheet).
 * Format for Trusts:
 * Assets = Corpus & Earmarked Funds + Liabilities + Accumulated Surplus + Current Surplus/(Deficit)
 */
async function getStatementOfAffairs(trustId, { asOfDate, fy } = {}, tx = prismaClient) {
  await ensureDefaultAccounts(trustId, tx)

  let cutoffDate
  if (asOfDate) {
    cutoffDate = new Date(asOfDate)
  } else if (fy) {
    const range = getFYDateRange(fy)
    cutoffDate = range.to
  } else {
    cutoffDate = new Date()
  }

  const accounts = await tx.account.findMany({
    where: { trust_id: trustId, is_active: true },
    orderBy: { code: 'asc' },
  })

  const lines = await tx.journalLine.findMany({
    where: {
      account: { trust_id: trustId },
      journal_entry: {
        trust_id: trustId,
        is_reversed: false,
        entry_date: { lte: cutoffDate },
      },
    },
    select: {
      account_id: true,
      debit: true,
      credit: true,
    },
  })

  const lineMap = new Map()
  for (const l of lines) {
    const curr = lineMap.get(l.account_id) || { debit: 0, credit: 0 }
    curr.debit += Number(l.debit) || 0
    curr.credit += Number(l.credit) || 0
    lineMap.set(l.account_id, curr)
  }

  const assets = []
  const liabilities = []
  const corpus = []

  let totalAssets = 0
  let totalLiabilities = 0
  let totalCorpus = 0
  let accumulatedSurplus = 0

  // Also calculate net income & expenses up to cutoff date to include current period surplus
  let periodIncome = 0
  let periodExpense = 0

  for (const acc of accounts) {
    const entry = lineMap.get(acc.id) || { debit: 0, credit: 0 }
    const dr = entry.debit
    const cr = entry.credit

    if (acc.account_type === 'ASSET') {
      const net = Math.round((dr - cr) * 100) / 100
      if (net !== 0) {
        assets.push({ code: acc.code, name: acc.name, amount: net })
        totalAssets += net
      }
    } else if (acc.account_type === 'LIABILITY') {
      if (acc.code === '3002') {
        accumulatedSurplus += Math.round((cr - dr) * 100) / 100
      } else {
        const net = Math.round((cr - dr) * 100) / 100
        if (net !== 0) {
          liabilities.push({ code: acc.code, name: acc.name, amount: net })
          totalLiabilities += net
        }
      }
    } else if (acc.account_type === 'CORPUS') {
      const net = Math.round((cr - dr) * 100) / 100
      if (net !== 0) {
        corpus.push({ code: acc.code, name: acc.name, amount: net })
        totalCorpus += net
      }
    } else if (acc.account_type === 'INCOME') {
      periodIncome += cr - dr
    } else if (acc.account_type === 'EXPENSE') {
      periodExpense += dr - cr
    }
  }

  const currentPeriodSurplus = Math.round((periodIncome - periodExpense) * 100) / 100
  const totalFundsAndLiabilities = Math.round((totalCorpus + totalLiabilities + accumulatedSurplus + currentPeriodSurplus) * 100) / 100

  return {
    as_of_date: cutoffDate,
    assets: {
      items: assets,
      total: Math.round(totalAssets * 100) / 100,
    },
    funds_and_liabilities: {
      corpus_items: corpus,
      total_corpus: Math.round(totalCorpus * 100) / 100,
      liabilities_items: liabilities,
      total_liabilities: Math.round(totalLiabilities * 100) / 100,
      accumulated_surplus: Math.round(accumulatedSurplus * 100) / 100,
      current_surplus_or_deficit: currentPeriodSurplus,
      total: totalFundsAndLiabilities,
    },
    is_balanced: Math.abs(Math.round(totalAssets * 100) / 100 - totalFundsAndLiabilities) < 0.05,
    difference: Math.round((totalAssets - totalFundsAndLiabilities) * 100) / 100,
  }
}

/**
 * Account ledger statement: opening balance + chronological entries with running balance.
 */
async function getAccountLedger(trustId, accountId, { fromDate, toDate } = {}, tx = prismaClient) {
  const account = await tx.account.findFirst({
    where: { id: accountId, trust_id: trustId },
  })
  if (!account) throw new Error('Account not found')

  const isDebitNormal = account.normal_balance === 'DEBIT'

  let openingBalance = 0
  if (fromDate) {
    const priorLines = await tx.journalLine.findMany({
      where: {
        account_id: accountId,
        journal_entry: {
          trust_id: trustId,
          is_reversed: false,
          entry_date: { lt: new Date(fromDate) },
        },
      },
      select: { debit: true, credit: true },
    })

    for (const l of priorLines) {
      const dr = Number(l.debit) || 0
      const cr = Number(l.credit) || 0
      openingBalance += isDebitNormal ? dr - cr : cr - dr
    }
  }

  const dateFilter = {}
  if (fromDate || toDate) {
    dateFilter.entry_date = {}
    if (fromDate) dateFilter.entry_date.gte = new Date(fromDate)
    if (toDate) dateFilter.entry_date.lte = new Date(toDate)
  }

  const entries = await tx.journalLine.findMany({
    where: {
      account_id: accountId,
      journal_entry: {
        trust_id: trustId,
        ...dateFilter,
      },
    },
    include: {
      journal_entry: {
        select: {
          id: true,
          entry_number: true,
          entry_date: true,
          voucher_type: true,
          narration: true,
          is_reversed: true,
        },
      },
    },
    orderBy: [
      { journal_entry: { entry_date: 'asc' } },
      { journal_entry: { created_at: 'asc' } },
    ],
  })

  let running = openingBalance
  let totalDebit = 0
  let totalCredit = 0

  const rows = entries.map((line) => {
    const dr = Number(line.debit) || 0
    const cr = Number(line.credit) || 0
    if (!line.journal_entry.is_reversed) {
      totalDebit += dr
      totalCredit += cr
      running += isDebitNormal ? dr - cr : cr - dr
    }

    return {
      id: line.id,
      journal_entry_id: line.journal_entry.id,
      entry_number: line.journal_entry.entry_number,
      entry_date: line.journal_entry.entry_date,
      voucher_type: line.journal_entry.voucher_type,
      narration: line.narration || line.journal_entry.narration || '',
      debit: dr,
      credit: cr,
      running_balance: Math.round(running * 100) / 100,
      is_reversed: line.journal_entry.is_reversed,
    }
  })

  return {
    account,
    opening_balance: Math.round(openingBalance * 100) / 100,
    closing_balance: Math.round(running * 100) / 100,
    total_debit: Math.round(totalDebit * 100) / 100,
    total_credit: Math.round(totalCredit * 100) / 100,
    entries: rows,
  }
}

module.exports = {
  DEFAULT_ACCOUNTS,
  getFYFromDate,
  getFYDateRange,
  ensureDefaultAccounts,
  ensurePurposeAccount,
  ensureExpenseAccount,
  generateJournalEntryNumber,
  createJournalEntry,
  postDonationJournal,
  reverseDonationJournal,
  postExpenseJournal,
  reverseExpenseJournal,
  postOpeningBalances,
  backfillCurrentFY,
  getTrialBalance,
  getIncomeAndExpenditure,
  getStatementOfAffairs,
  getAccountLedger,
}
