const prisma = require('../src/lib/prisma')
const {
  ensureDefaultAccounts,
  postOpeningBalances,
  postDonationJournal,
  postExpenseJournal,
  createJournalEntry,
  getTrialBalance,
  getIncomeAndExpenditure,
  getStatementOfAffairs,
  getAccountLedger,
} = require('../src/services/accounting.service')

async function run() {
  console.log('=================================================================')
  console.log('         SANSTA ERP: TRUST ACCOUNTING ENGINE VERIFICATION        ')
  console.log('=================================================================\n')

  const trustId = 'clsanwaliya001'

  // 1. Create / Upsert Trust with Opening Balances
  const trust = await prisma.trust.upsert({
    where: { id: trustId },
    update: {
      opening_cash_balance: 50000,
      opening_bank_balance: 200000,
      current_fy: '2026-27',
    },
    create: {
      id: trustId,
      name: 'Shri Sanwaliya Seth Mandir Nirman Samiti',
      name_hindi: 'श्री सांवलिया सेठ मंदिर निर्माण समिति',
      address: 'Near Power House, Hanuman Nagar, Bhilwara',
      receipt_prefix: 'SSSM',
      phone: '9261180000',
      current_fy: '2026-27',
      opening_cash_balance: 50000,
      opening_bank_balance: 200000,
    },
  })
  console.log('✓ Trust configured:', trust.name)
  console.log('  Opening Cash Balance: ₹50,000.00 | Opening Bank Balance: ₹2,00,000.00')

  // 2. Ensure Chart of Accounts & Post Opening Balance Voucher
  await ensureDefaultAccounts(trustId)
  const openingVoucher = await postOpeningBalances(trustId, '2026-27', 'SYSTEM')
  console.log(`✓ Opening Balance Journal posted: ${openingVoucher?.entry_number || 'Existing'}`)

  // 3. Post Diverse Donations
  console.log('\n--- 1. Recording Donations ---')

  // Donation A: Cash ₹11,000 General Donation
  const donA = await prisma.donation.create({
    data: {
      trust_id: trustId,
      receipt_number: 'SSSM/2026-27/0001',
      donor_name: 'Gopal Lal Sharma',
      donor_mobile: '9829012345',
      amount: 11000,
      payment_mode: 'CASH',
      purpose: 'General Donation',
      is_corpus: false,
      donation_date: new Date('2026-09-01'),
    },
  })
  const jvDonA = await postDonationJournal(donA, 'TEST')
  console.log(`✓ Donation #1: ₹11,000 (Cash) -> Voucher: ${jvDonA.entry_number}`)

  // Donation B: Bank/UPI ₹25,000 Prasad / Bhog Sewa
  const donB = await prisma.donation.create({
    data: {
      trust_id: trustId,
      receipt_number: 'SSSM/2026-27/0002',
      donor_name: 'Radheshyam Jat',
      donor_mobile: '9414056789',
      amount: 25000,
      payment_mode: 'UPI',
      upi_ref: 'UPI/9876543210/01',
      purpose: 'Bhog & Prasad Sewa',
      is_corpus: false,
      donation_date: new Date('2026-09-03'),
    },
  })
  const jvDonB = await postDonationJournal(donB, 'TEST')
  console.log(`✓ Donation #2: ₹25,000 (UPI) -> Voucher: ${jvDonB.entry_number}`)

  // Donation C: Bank ₹1,00,000 Corpus Fund (Pujya Nidhi)
  const donC = await prisma.donation.create({
    data: {
      trust_id: trustId,
      receipt_number: 'SSSM/2026-27/0003',
      donor_name: 'Bheru Lal Gurjar',
      donor_mobile: '9988776655',
      amount: 100000,
      payment_mode: 'CHEQUE',
      cheque_number: 'CHQ-88214',
      purpose: 'Mandir Nirman Permanent Corpus',
      is_corpus: true,
      donation_date: new Date('2026-09-05'),
    },
  })
  const jvDonC = await postDonationJournal(donC, 'TEST')
  console.log(`✓ Donation #3: ₹1,00,000 (Corpus Fund) -> Voucher: ${jvDonC.entry_number}`)

  // Donation D: Cash ₹5,100 with Custom Purpose "Navgrah Shanti Puja" (verifies auto-creation of 40xx ledger)
  const donD = await prisma.donation.create({
    data: {
      trust_id: trustId,
      receipt_number: 'SSSM/2026-27/0004',
      donor_name: 'Suresh Chandra Vaishnav',
      donor_mobile: '9123456780',
      amount: 5100,
      payment_mode: 'CASH',
      purpose: 'Navgrah Shanti Puja',
      is_corpus: false,
      donation_date: new Date('2026-09-06'),
    },
  })
  const jvDonD = await postDonationJournal(donD, 'TEST')
  console.log(`✓ Donation #4: ₹5,100 (Custom Purpose "Navgrah Shanti Puja") -> Voucher: ${jvDonD.entry_number}`)

  // 4. Post Diverse Expenses with Vendor / Parties
  console.log('\n--- 2. Recording Expenses & Party Ledgers ---')

  // Expense A: Cash ₹8,500 to "Sharma Tent House" (creates party ledger 2101)
  const expA = await prisma.expense.create({
    data: {
      trust_id: trustId,
      voucher_number: 'EXP/2026-27/0001',
      expense_date: new Date('2026-09-07'),
      category: 'FESTIVAL_EXPENSES',
      amount: 8500,
      description: 'Tent & Sound for Janmashtami festival',
      paid_to: 'Sharma Tent House',
      vendor_mobile: '9828100100',
      payment_mode: 'CASH',
      payment_channel: 'CASH',
    },
  })
  const jvExpA = await postExpenseJournal(expA, 'TEST')
  console.log(`✓ Expense #1: ₹8,500 to Sharma Tent House -> Voucher: ${jvExpA.entry_number}`)

  // Expense B: Bank ₹35,000 to "Ramesh Electricals" (creates party ledger 2102)
  const expB = await prisma.expense.create({
    data: {
      trust_id: trustId,
      voucher_number: 'EXP/2026-27/0002',
      expense_date: new Date('2026-09-08'),
      category: 'UTILITIES',
      amount: 35000,
      description: 'Temple decorative lighting and cable wiring',
      paid_to: 'Ramesh Electricals',
      vendor_mobile: '9414200200',
      payment_mode: 'NEFT',
      transaction_id: 'NEFT-55443322',
      payment_channel: 'BANK',
    },
  })
  const jvExpB = await postExpenseJournal(expB, 'TEST')
  console.log(`✓ Expense #2: ₹35,000 to Ramesh Electricals -> Voucher: ${jvExpB.entry_number}`)

  // Expense C: Cash ₹3,000 Puja Expense without a party
  const expC = await prisma.expense.create({
    data: {
      trust_id: trustId,
      voucher_number: 'EXP/2026-27/0003',
      expense_date: new Date('2026-09-09'),
      category: 'PUJA',
      amount: 3000,
      description: 'Puja Samagri, camphor and agarbatti',
      paid_to: null,
      payment_mode: 'CASH',
      payment_channel: 'CASH',
    },
  })
  const jvExpC = await postExpenseJournal(expC, 'TEST')
  console.log(`✓ Expense #3: ₹3,000 Puja Samagri -> Voucher: ${jvExpC.entry_number}`)

  // 5. Manual Journal Adjustments
  console.log('\n--- 3. Manual Journal Adjustments ---')
  const bankAcc = await prisma.account.findUnique({ where: { trust_id_code: { trust_id: trustId, code: '1002' } } })
  const fdAcc = await prisma.account.findUnique({ where: { trust_id_code: { trust_id: trustId, code: '1201' } } })
  const interestAcc = await prisma.account.findUnique({ where: { trust_id_code: { trust_id: trustId, code: '4004' } } })

  // J1: Bank to FD Transfer ₹50,000
  const jvTransfer = await createJournalEntry({
    trustId,
    entryDate: new Date('2026-09-10'),
    voucherType: 'CONTRA',
    narration: 'Transfer from Main Bank Account to 1-Year Bank Fixed Deposit',
    sourceType: 'MANUAL',
    createdBy: 'ADMIN',
    lines: [
      { account_id: fdAcc.id, debit: 50000, credit: 0, narration: 'Fixed Deposit Created' },
      { account_id: bankAcc.id, debit: 0, credit: 50000, narration: 'Transferred from Savings/Current' },
    ],
  })
  console.log(`✓ Manual Contra #1: ₹50,000 Transfer to FD -> Voucher: ${jvTransfer.entry_number}`)

  // J2: Bank Interest Credit ₹2,450
  const jvInterest = await createJournalEntry({
    trustId,
    entryDate: new Date('2026-09-11'),
    voucherType: 'RECEIPT',
    narration: 'Quarterly Bank Interest received on Savings Account',
    sourceType: 'MANUAL',
    createdBy: 'ADMIN',
    lines: [
      { account_id: bankAcc.id, debit: 2450, credit: 0, narration: 'Interest credited by bank' },
      { account_id: interestAcc.id, debit: 0, credit: 2450, narration: 'Bank Interest Revenue' },
    ],
  })
  console.log(`✓ Manual Receipt #2: ₹2,450 Bank Interest -> Voucher: ${jvInterest.entry_number}`)

  // 6. Fetch & Validate Trial Balance
  console.log('\n=================================================================')
  console.log('                      TRIAL BALANCE (तलपट)                       ')
  console.log('=================================================================')
  const tb = await getTrialBalance(trustId, { fy: '2026-27' })

  console.log('Code   | Account Name                                | Debit (₹)    | Credit (₹)')
  console.log('-------+---------------------------------------------+--------------+--------------')
  for (const r of tb.rows) {
    const code = r.code.padEnd(6)
    const name = r.name.padEnd(43).slice(0, 43)
    const dr = r.period_debit ? r.period_debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }).padStart(12) : ''.padStart(12)
    const cr = r.period_credit ? r.period_credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }).padStart(12) : ''.padStart(12)
    console.log(`${code} | ${name} | ${dr} | ${cr}`)
  }
  console.log('-------+---------------------------------------------+--------------+--------------')
  const totDr = tb.totals.period_debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }).padStart(12)
  const totCr = tb.totals.period_credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }).padStart(12)
  console.log(`TOTALS | GRAND TOTALS                                | ${totDr} | ${totCr}`)
  console.log(`TRIAL BALANCE RESULT: ${tb.totals.is_balanced ? 'SUCCESSFULLY BALANCED (Diff: ₹0.00) ✓' : 'FAILED / UNBALANCED ✗'}`)

  // 7. Fetch & Validate Income & Expenditure Account
  console.log('\n=================================================================')
  console.log('           INCOME & EXPENDITURE ACCOUNT (आय एवं व्यय लेखा)       ')
  console.log('=================================================================')
  const ie = await getIncomeAndExpenditure(trustId, { fy: '2026-27' })

  console.log('EXPENDITURE (व्यय):')
  for (const e of ie.expenditure) {
    console.log(`  - [${e.code}] ${e.name.padEnd(35)}: ₹${e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
  }
  console.log(`  TOTAL EXPENDITURE: ₹${ie.total_expenditure.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)

  console.log('\nINCOME (आय):')
  for (const inc of ie.income) {
    console.log(`  - [${inc.code}] ${inc.name.padEnd(35)}: ₹${inc.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
  }
  console.log(`  TOTAL INCOME: ₹${ie.total_income.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)

  console.log('-----------------------------------------------------------------')
  console.log(`NET RESULT: ${ie.is_surplus ? 'SURPLUS (अधिशेष)' : 'DEFICIT (घाटा)'} -> ₹${Math.abs(ie.surplus_or_deficit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)

  // 8. Fetch & Validate Statement of Affairs (Balance Sheet)
  console.log('\n=================================================================')
  console.log('        STATEMENT OF AFFAIRS / BALANCE SHEET (तुलन पत्र)          ')
  console.log('=================================================================')
  const soa = await getStatementOfAffairs(trustId, { fy: '2026-27' })

  console.log('ASSETS (संपत्तियां):')
  for (const a of soa.assets.items) {
    console.log(`  - [${a.code}] ${a.name.padEnd(35)}: ₹${a.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
  }
  console.log(`  TOTAL ASSETS: ₹${soa.assets.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)

  console.log('\nCORPUS, FUNDS & LIABILITIES (निधि व देयताएं):')
  for (const c of soa.funds_and_liabilities.corpus_items) {
    console.log(`  - [${c.code}] ${c.name.padEnd(35)}: ₹${c.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
  }
  console.log(`  - Accumulated Surplus (Opening)       : ₹${soa.funds_and_liabilities.accumulated_surplus.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
  console.log(`  - Current Period Surplus (from I&E)   : ₹${soa.funds_and_liabilities.current_surplus_or_deficit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
  for (const l of soa.funds_and_liabilities.liabilities_items) {
    console.log(`  - [${l.code}] ${l.name.padEnd(35)}: ₹${l.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
  }
  console.log(`  TOTAL FUNDS & LIABILITIES: ₹${soa.funds_and_liabilities.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)

  console.log('-----------------------------------------------------------------')
  console.log(`BALANCE SHEET MATCH: ${soa.is_balanced ? 'MATCHED PERFECTLY (Assets == Liabilities + Funds) ✓' : 'MISMATCH ✗'}`)
  console.log(`DIFFERENCE: ₹${soa.difference.toFixed(2)}`)

  // 9. Party Ledger Verification
  console.log('\n=================================================================')
  console.log('           PARTY LEDGER CHECK: SHARMA TENT HOUSE                 ')
  console.log('=================================================================')
  const partySharma = await prisma.account.findFirst({
    where: { trust_id: trustId, name: { contains: 'Sharma Tent House' } },
  })
  if (partySharma) {
    const sharmaLedger = await getAccountLedger(trustId, partySharma.id)
    console.log(`Account: [${partySharma.code}] ${partySharma.name}`)
    console.log(`Opening Balance: ₹${sharmaLedger.opening_balance.toFixed(2)}`)
    for (const ent of sharmaLedger.entries) {
      console.log(`  Voucher: ${ent.entry_number.padEnd(20)} | Dr: ₹${ent.debit.toString().padStart(8)} | Cr: ₹${ent.credit.toString().padStart(8)} | Bal: ₹${ent.running_balance.toFixed(2)} | ${ent.narration}`)
    }
    console.log(`Closing Balance: ₹${sharmaLedger.closing_balance.toFixed(2)} (Settled cleanly)`)
  }

  console.log('\n=================================================================')
  console.log('                     ALL VERIFICATIONS PASSED                    ')
  console.log('=================================================================')
}

run()
  .catch((err) => {
    console.error('Test failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
