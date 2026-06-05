const prisma = require('../lib/prisma')

function buildDateRange(whereField, dateFrom, dateTo) {
  if (dateFrom && dateTo) return { [whereField]: { gte: dateFrom, lte: dateTo } }
  if (dateFrom) return { [whereField]: { gte: dateFrom } }
  if (dateTo) return { [whereField]: { lte: dateTo } }
  return {}
}

function formatDateOnly(date) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatBalanceWithSide(value) {
  const n = Number(value) || 0
  const side = n >= 0 ? 'Dr' : 'Cr'
  return `${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${side}`
}

function entryDebitCredit(entry) {
  const amt = Math.abs(Number(entry.amount) || 0)
  if (entry.kind === 'DONATION') {
    return { debit: amt, credit: 0 }
  }
  return { debit: 0, credit: amt }
}

function enrichLedgerRows(ledger) {
  if (!ledger) return ledger

  const entries = (ledger.entries || []).map((row) => {
    const { debit, credit } = entryDebitCredit(row)
    return {
      ...row,
      debit,
      credit,
      type_label: row.kind === 'DONATION' ? 'Donation' : 'Expense',
    }
  })

  return {
    ...ledger,
    entries,
    totals: {
      debit: entries.reduce((s, r) => s + r.debit, 0),
      credit: entries.reduce((s, r) => s + r.credit, 0),
    },
    totals_with_opening: {
      receipts:
        entries.reduce((s, r) => s + r.debit, 0) +
        (Number(ledger.opening_balance || 0) > 0 ? Number(ledger.opening_balance) : 0),
      payments:
        entries.reduce((s, r) => s + r.credit, 0) +
        (Number(ledger.opening_balance || 0) < 0 ? Math.abs(Number(ledger.opening_balance)) : 0),
    },
  }
}

async function computeChannelLedger({ trustId, channel, dateFrom, dateTo }) {
  const trust = await prisma.trust.findFirst({
    where: { id: trustId, is_active: true },
    select: { opening_cash_balance: true, opening_bank_balance: true },
  })

  if (!trust) return null

  const baseOpening =
    channel === 'CASH' ? Number(trust.opening_cash_balance || 0) : Number(trust.opening_bank_balance || 0)

  let opening = baseOpening
  if (dateFrom) {
    const openingAdjustWhereDonations = {
      trust_id: trustId,
      is_deleted: false,
      ...(channel === 'CASH' ? { payment_mode: 'CASH' } : { payment_mode: { not: 'CASH' } }),
      donation_date: { lt: dateFrom },
    }

    const openingAdjustWhereExpenses = {
      trust_id: trustId,
      payment_channel: channel,
      expense_date: { lt: dateFrom },
    }

    const [donAdj, expAdj] = await Promise.all([
      prisma.donation.aggregate({
        where: openingAdjustWhereDonations,
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: openingAdjustWhereExpenses,
        _sum: { amount: true },
      }),
    ])

    opening = baseOpening + Number(donAdj._sum.amount || 0) - Number(expAdj._sum.amount || 0)
  }

  const donationWhere = {
    trust_id: trustId,
    is_deleted: false,
    amount: { gt: 0 },
    ...(channel === 'CASH' ? { payment_mode: 'CASH' } : { payment_mode: { not: 'CASH' } }),
    ...buildDateRange('donation_date', dateFrom, dateTo),
  }

  const expenseWhere = {
    trust_id: trustId,
    payment_channel: channel,
    ...buildDateRange('expense_date', dateFrom, dateTo),
  }

  const [donations, expenses] = await Promise.all([
    prisma.donation.findMany({
      where: donationWhere,
      select: {
        id: true,
        donor_name: true,
        donor_city: true,
        amount: true,
        donation_date: true,
        receipt_number: true,
        notes: true,
        created_at: true,
        created_by_user: { select: { name: true, username: true } },
      },
      orderBy: [{ donation_date: 'asc' }, { created_at: 'asc' }],
    }),
    prisma.expense.findMany({
      where: expenseWhere,
      select: {
        id: true,
        category: true,
        amount: true,
        expense_date: true,
        description: true,
        reference: true,
        voucher_number: true,
        paid_to: true,
        notes: true,
        created_at: true,
        created_by_user: { select: { name: true, username: true } },
      },
      orderBy: [{ expense_date: 'asc' }, { created_at: 'asc' }],
    }),
  ])

  const items = [
    ...donations.map((d) => ({
      kind: 'DONATION',
      channel,
      date: d.donation_date,
      createdAt: d.created_at,
      description: d.donor_name,
      meta: d.donor_city || '',
      amount: Number(d.amount),
      ref: d.receipt_number,
      narration: d.notes || '',
      createdBy: d.created_by_user?.name || d.created_by_user?.username || '',
      id: d.id,
    })),
    ...expenses.map((e) => ({
      kind: 'EXPENSE',
      channel,
      date: e.expense_date,
      createdAt: e.created_at,
      description: e.description,
      meta: e.paid_to || e.category,
      amount: -Number(e.amount),
      ref: e.reference || e.voucher_number || '',
      narration: e.notes || '',
      createdBy: e.created_by_user?.name || e.created_by_user?.username || '',
      id: e.id,
    })),
  ].sort((a, b) => {
    const da = new Date(a.date).getTime()
    const db = new Date(b.date).getTime()
    if (da !== db) return da - db
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  let running = opening
  const rows = items.map((it) => {
    running += it.amount
    return {
      id: it.id,
      kind: it.kind,
      channel: it.channel,
      date: it.date,
      description: it.description,
      meta: it.meta,
      amount: it.amount,
      ref: it.ref,
      narration: it.narration,
      created_by: it.createdBy,
      entry_timestamp: it.createdAt,
      running_balance: running,
    }
  })

  const closing = rows.length ? rows[rows.length - 1].running_balance : opening

  return enrichLedgerRows({
    opening_balance: opening,
    closing_balance: closing,
    entries: rows,
  })
}

async function getCashbookData(trustId, dateFrom, dateTo) {
  const from = dateFrom ? new Date(dateFrom) : null
  const to = dateTo ? new Date(dateTo) : null

  const [cash, bank] = await Promise.all([
    computeChannelLedger({ trustId, channel: 'CASH', dateFrom: from, dateTo: to }),
    computeChannelLedger({ trustId, channel: 'BANK', dateFrom: from, dateTo: to }),
  ])

  return { CASH: cash, BANK: bank }
}

function buildExportRows(ledger) {
  const opening = Number(ledger.opening_balance || 0)
  const openingDebit = opening > 0 ? opening : 0
  const openingCredit = opening < 0 ? Math.abs(opening) : 0

  const rows = [
    [
      '',
      'Opening',
      'Balance brought forward',
      '',
      '',
      openingDebit || '',
      openingCredit || '',
      opening,
    ],
    ...(ledger.entries || []).map((e) => [
      formatDateOnly(e.date),
      e.type_label,
      e.description,
      e.meta || '',
      e.ref || '',
      e.debit || '',
      e.credit || '',
      Number(e.running_balance || 0),
    ]),
  ]

  const totalDebit = (ledger.totals?.debit || 0) + openingDebit
  const totalCredit = (ledger.totals?.credit || 0) + openingCredit

  const totalsRow = [
    '',
    '',
    'Total',
    '',
    '',
    totalDebit,
    totalCredit,
    Number(ledger.closing_balance || 0),
  ]

  return { rows, totalsRow, totalDebit, totalCredit }
}

function buildPeriodLabel(dateFrom, dateTo) {
  if (dateFrom && dateTo) {
    return `Period: ${formatDateOnly(dateFrom)} to ${formatDateOnly(dateTo)}`
  }
  if (dateFrom) return `From: ${formatDateOnly(dateFrom)}`
  if (dateTo) return `Up to: ${formatDateOnly(dateTo)}`
  return `Generated: ${formatDateOnly(new Date())}`
}

module.exports = {
  computeChannelLedger,
  getCashbookData,
  buildExportRows,
  buildPeriodLabel,
  formatDateOnly,
  entryDebitCredit,
  formatBalanceWithSide,
}
