import { useState, useMemo } from 'react'
import {
  BookOpen,
  Plus,
  RefreshCw,
  Search,
  Filter,
  ArrowRightLeft,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Eye,
  RotateCcw,
  Calendar,
  Layers,
  Scale,
  Landmark,
  FileText,
} from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  useAccounts,
  useCreateAccount,
  useJournals,
  useCreateJournal,
  useReverseJournal,
  useAccountLedger,
  useBackfillAccounting,
  useTrialBalance,
  useIncomeExpenditure,
  useStatementOfAffairs,
  exportAccountingExcel,
} from '@/hooks/useAccounting'
import { formatCurrency, todayISO } from '@/utils/formatters'
import { toast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api'

const VOUCHER_TYPE_COLORS = {
  RECEIPT: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  PAYMENT: 'bg-amber-100 text-amber-800 border-amber-300',
  JOURNAL: 'bg-blue-100 text-blue-800 border-blue-300',
  OPENING: 'bg-purple-100 text-purple-800 border-purple-300',
  CONTRA: 'bg-cyan-100 text-cyan-800 border-cyan-300',
}

const ACCOUNT_TYPE_LABELS = {
  ASSET: { label: 'Asset (संपत्ति)', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  LIABILITY: { label: 'Liability & Parties (देयता व पार्टियां)', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  CORPUS: { label: 'Corpus & Reserves (निधि / पूंजी)', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  INCOME: { label: 'Income (आय)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  EXPENSE: { label: 'Expense (व्यय)', color: 'bg-rose-50 text-rose-700 border-rose-200' },
}

export default function Accounting() {
  const [activeTab, setActiveTab] = useState('journals')

  // Journal Entry Filters
  const [journalSearch, setJournalSearch] = useState('')
  const [journalType, setJournalType] = useState('ALL')
  const [journalDateFrom, setJournalDateFrom] = useState('')
  const [journalDateTo, setJournalDateTo] = useState('')
  const [journalPage, setJournalPage] = useState(1)

  // Account Ledger state
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState('')
  const [ledgerDateFrom, setLedgerDateFrom] = useState('')
  const [ledgerDateTo, setLedgerDateTo] = useState('')

  // Modals
  const [isNewVoucherOpen, setIsNewVoucherOpen] = useState(false)
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false)
  const [selectedVoucherForView, setSelectedVoucherForView] = useState(null)
  const [isBackfilling, setIsBackfilling] = useState(false)

  // Chart of accounts filter
  const [coaTypeFilter, setCoaTypeFilter] = useState('ALL')

  // Data queries
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts()
  const { data: journalsData, isLoading: journalsLoading } = useJournals({
    page: journalPage,
    limit: 25,
    search: journalSearch || undefined,
    voucher_type: journalType === 'ALL' ? undefined : journalType,
    date_from: journalDateFrom || undefined,
    date_to: journalDateTo || undefined,
  })

  const { data: ledgerData, isLoading: ledgerLoading } = useAccountLedger(
    selectedLedgerAccountId,
    {
      date_from: ledgerDateFrom || undefined,
      date_to: ledgerDateTo || undefined,
    }
  )

  const { data: trialBalance } = useTrialBalance({
    date_from: journalDateFrom || undefined,
    date_to: journalDateTo || undefined,
  })
  const { data: incomeExp } = useIncomeExpenditure({
    date_from: journalDateFrom || undefined,
    date_to: journalDateTo || undefined,
  })
  const { data: statementOfAffairs } = useStatementOfAffairs({
    as_of_date: journalDateTo || undefined,
  })

  // Mutations
  const createJournalMutation = useCreateJournal()
  const reverseJournalMutation = useReverseJournal()
  const createAccountMutation = useCreateAccount()
  const backfillMutation = useBackfillAccounting()

  // Manual voucher form state
  const [voucherForm, setVoucherForm] = useState({
    entry_date: todayISO(),
    voucher_type: 'JOURNAL',
    narration: '',
    lines: [
      { account_id: '', debit: '', credit: '', narration: '' },
      { account_id: '', debit: '', credit: '', narration: '' },
    ],
  })

  // New account form state
  const [accountForm, setAccountForm] = useState({
    code: '',
    name: '',
    account_type: 'EXPENSE',
    normal_balance: 'DEBIT',
    description: '',
  })

  const voucherTotals = useMemo(() => {
    let dr = 0
    let cr = 0
    voucherForm.lines.forEach((l) => {
      dr += parseFloat(l.debit) || 0
      cr += parseFloat(l.credit) || 0
    })
    return {
      debit: Math.round(dr * 100) / 100,
      credit: Math.round(cr * 100) / 100,
      diff: Math.round(Math.abs(dr - cr) * 100) / 100,
      isBalanced: Math.abs(dr - cr) < 0.05 && dr > 0,
    }
  }, [voucherForm.lines])

  const filteredAccounts = useMemo(() => {
    if (coaTypeFilter === 'ALL') return accounts
    return accounts.filter((a) => a.account_type === coaTypeFilter)
  }, [accounts, coaTypeFilter])

  const handleLineChange = (index, field, value) => {
    const updated = [...voucherForm.lines]
    updated[index] = { ...updated[index], [field]: value }
    setVoucherForm({ ...voucherForm, lines: updated })
  }

  const addVoucherLine = () => {
    setVoucherForm({
      ...voucherForm,
      lines: [...voucherForm.lines, { account_id: '', debit: '', credit: '', narration: '' }],
    })
  }

  const removeVoucherLine = (index) => {
    if (voucherForm.lines.length <= 2) return
    const updated = voucherForm.lines.filter((_, i) => i !== index)
    setVoucherForm({ ...voucherForm, lines: updated })
  }

  const handleCreateVoucher = async (e) => {
    e.preventDefault()
    if (!voucherTotals.isBalanced) {
      toast({
        title: 'Unbalanced Voucher',
        description: `Total Debit (₹${voucherTotals.debit}) must equal Total Credit (₹${voucherTotals.credit})`,
        variant: 'destructive',
      })
      return
    }

    try {
      await createJournalMutation.mutateAsync({
        entry_date: voucherForm.entry_date,
        voucher_type: voucherForm.voucher_type,
        narration: voucherForm.narration,
        lines: voucherForm.lines.map((l) => ({
          account_id: l.account_id,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          narration: l.narration || undefined,
        })),
      })

      toast({
        title: 'Voucher Created',
        description: 'Journal entry has been recorded in the general ledger.',
      })
      setIsNewVoucherOpen(false)
      setVoucherForm({
        entry_date: todayISO(),
        voucher_type: 'JOURNAL',
        narration: '',
        lines: [
          { account_id: '', debit: '', credit: '', narration: '' },
          { account_id: '', debit: '', credit: '', narration: '' },
        ],
      })
    } catch (err) {
      toast({
        title: 'Failed to record voucher',
        description: getApiErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const handleReverseVoucher = async (id) => {
    if (!confirm('Are you sure you want to reverse this journal voucher? A contra reversing entry will be generated.')) {
      return
    }
    try {
      await reverseJournalMutation.mutateAsync(id)
      toast({
        title: 'Voucher Reversed',
        description: 'The journal entry has been reversed.',
      })
      setSelectedVoucherForView(null)
    } catch (err) {
      toast({
        title: 'Reversal Failed',
        description: getApiErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const handleCreateAccount = async (e) => {
    e.preventDefault()
    try {
      await createAccountMutation.mutateAsync(accountForm)
      toast({
        title: 'Account Created',
        description: `Account [${accountForm.code}] ${accountForm.name} added to Chart of Accounts.`,
      })
      setIsNewAccountOpen(false)
      setAccountForm({
        code: '',
        name: '',
        account_type: 'EXPENSE',
        normal_balance: 'DEBIT',
        description: '',
      })
    } catch (err) {
      toast({
        title: 'Failed to create account',
        description: getApiErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const handleBackfill = async () => {
    if (
      !confirm(
        'This will scan all donations, expenses, and opening balances for the current Financial Year and ensure balanced double-entry vouchers exist in the ledger. Continue?'
      )
    ) {
      return
    }
    setIsBackfilling(true)
    try {
      const res = await backfillMutation.mutateAsync()
      toast({
        title: 'Backfill Completed',
        description: `FY ${res?.result?.fy || ''}: Posted ${res?.result?.donationsPosted || 0} donation journals and ${res?.result?.expensesPosted || 0} expense journals.`,
      })
    } catch (err) {
      toast({
        title: 'Backfill Failed',
        description: getApiErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setIsBackfilling(false)
    }
  }

  const handleExport = async (type) => {
    try {
      await exportAccountingExcel(type, {
        date_from: journalDateFrom || undefined,
        date_to: journalDateTo || undefined,
        as_of_date: journalDateTo || undefined,
      })
      toast({
        title: 'Export Downloaded',
        description: 'Excel file generated successfully.',
      })
    } catch (err) {
      toast({
        title: 'Export Failed',
        description: getApiErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trust Accounting & General Ledger"
        mobileTitle="Accounting"
        description="Double-entry books, journal vouchers, chart of accounts & statutory trust accounts."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackfill}
            disabled={isBackfilling}
            className="border-dashed"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isBackfilling ? 'animate-spin' : ''}`} />
            Sync Past FY Entries
          </Button>
          <Button
            size="sm"
            onClick={() => setIsNewVoucherOpen(true)}
            className="bg-saffron text-white hover:bg-saffron/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Journal Voucher
          </Button>
        </div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl bg-muted/60 p-1">
          <TabsTrigger value="journals" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <BookOpen className="h-4 w-4" />
            <span>Journal Vouchers</span>
          </TabsTrigger>
          <TabsTrigger value="accounts" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Layers className="h-4 w-4" />
            <span>Chart of Accounts</span>
          </TabsTrigger>
          <TabsTrigger value="ledger" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <FileText className="h-4 w-4" />
            <span>Account Ledger</span>
          </TabsTrigger>
          <TabsTrigger value="statutory" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Landmark className="h-4 w-4" />
            <span>Statutory Reports</span>
          </TabsTrigger>
        </TabsList>

        {/* 1. JOURNAL ENTRIES TAB */}
        <TabsContent value="journals" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base sm:text-lg">Journal Book (रोज़नामचा / प्रविष्टियां)</CardTitle>
                  <CardDescription>
                    Complete double-entry audit trail for all receipts, payments, and adjusting journal entries.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={journalType} onValueChange={(val) => { setJournalType(val); setJournalPage(1); }}>
                    <SelectTrigger className="w-[140px] h-9 text-xs">
                      <SelectValue placeholder="Voucher Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="RECEIPT">Receipt (REC)</SelectItem>
                      <SelectItem value="PAYMENT">Payment (PAY)</SelectItem>
                      <SelectItem value="JOURNAL">Journal (JV)</SelectItem>
                      <SelectItem value="OPENING">Opening (OPN)</SelectItem>
                      <SelectItem value="CONTRA">Contra (CON)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Filters row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search voucher # or narration..."
                    value={journalSearch}
                    onChange={(e) => { setJournalSearch(e.target.value); setJournalPage(1); }}
                    className="pl-8 h-9 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={journalDateFrom}
                    onChange={(e) => { setJournalDateFrom(e.target.value); setJournalPage(1); }}
                    className="h-9 text-xs"
                    placeholder="From Date"
                  />
                  <span className="text-muted-foreground text-xs">to</span>
                  <Input
                    type="date"
                    value={journalDateTo}
                    onChange={(e) => { setJournalDateTo(e.target.value); setJournalPage(1); }}
                    className="h-9 text-xs"
                    placeholder="To Date"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  {(journalSearch || journalType !== 'ALL' || journalDateFrom || journalDateTo) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setJournalSearch('')
                        setJournalType('ALL')
                        setJournalDateFrom('')
                        setJournalDateTo('')
                        setJournalPage(1)
                      }}
                      className="text-xs h-9"
                    >
                      Reset Filters
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[140px]">Voucher #</TableHead>
                    <TableHead className="w-[100px]">Date</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead>Narration / Particulars</TableHead>
                    <TableHead className="text-right">Debit (₹)</TableHead>
                    <TableHead className="text-right">Credit (₹)</TableHead>
                    <TableHead className="w-[80px] text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journalsLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Loading journal entries...
                      </TableCell>
                    </TableRow>
                  ) : journalsData?.entries?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No journal entries found matching criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    journalsData?.entries?.map((entry) => {
                      const totalDebit = entry.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
                      const totalCredit = entry.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
                      return (
                        <TableRow key={entry.id} className={entry.is_reversed ? 'opacity-60 bg-muted/20' : ''}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {entry.entry_number}
                            {entry.is_reversed && (
                              <span className="block text-[10px] text-rose-600 font-sans">Reversed</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(entry.entry_date).toLocaleDateString('en-IN')}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${
                                VOUCHER_TYPE_COLORS[entry.voucher_type] || 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {entry.voucher_type}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs max-w-xs truncate" title={entry.narration}>
                            {entry.narration || '—'}
                            <div className="text-[11px] text-muted-foreground flex gap-2 mt-0.5">
                              {entry.lines.slice(0, 2).map((l, idx) => (
                                <span key={idx}>
                                  {Number(l.debit) > 0 ? `Dr ${l.account?.name}` : `Cr ${l.account?.name}`}
                                </span>
                              ))}
                              {entry.lines.length > 2 && <span>+{entry.lines.length - 2} more</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-medium">
                            {formatCurrency(totalDebit)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-medium">
                            {formatCurrency(totalCredit)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setSelectedVoucherForView(entry)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {journalsData?.pagination?.pages > 1 && (
                <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground">
                  <div>
                    Page {journalsData.pagination.page} of {journalsData.pagination.pages} ({journalsData.pagination.total} entries)
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={journalPage <= 1}
                      onClick={() => setJournalPage((p) => Math.max(1, p - 1))}
                      className="h-8 text-xs"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={journalPage >= journalsData.pagination.pages}
                      onClick={() => setJournalPage((p) => p + 1)}
                      className="h-8 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. CHART OF ACCOUNTS TAB */}
        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base sm:text-lg">Chart of Accounts (लेखा चार्ट)</CardTitle>
                  <CardDescription>
                    Trust general ledger accounts across Assets, Liabilities, Corpus, Income, and Expenses.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsNewAccountOpen(true)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Custom Account
                  </Button>
                </div>
              </div>

              {/* Type Filter Chips */}
              <div className="flex flex-wrap gap-1.5 pt-2">
                {['ALL', 'ASSET', 'LIABILITY', 'CORPUS', 'INCOME', 'EXPENSE'].map((t) => (
                  <Button
                    key={t}
                    variant={coaTypeFilter === t ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setCoaTypeFilter(t)}
                  >
                    {t === 'ALL' ? 'All Accounts' : ACCOUNT_TYPE_LABELS[t]?.label || t}
                  </Button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[90px]">Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead className="w-[160px]">Classification</TableHead>
                    <TableHead className="w-[110px]">Normal Side</TableHead>
                    <TableHead className="w-[90px]">System</TableHead>
                    <TableHead className="w-[100px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Loading accounts...
                      </TableCell>
                    </TableRow>
                  ) : filteredAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No accounts found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAccounts.map((acc) => (
                      <TableRow key={acc.id}>
                        <TableCell className="font-mono text-xs font-bold text-maroon">
                          {acc.code}
                        </TableCell>
                        <TableCell className="font-medium text-xs">
                          {acc.name}
                          {acc.description && (
                            <span className="block text-[11px] text-muted-foreground">{acc.description}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] border font-medium ${
                              ACCOUNT_TYPE_LABELS[acc.account_type]?.color || 'bg-gray-100'
                            }`}
                          >
                            {acc.account_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {acc.normal_balance === 'DEBIT' ? 'Dr (Debit)' : 'Cr (Credit)'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {acc.is_system ? (
                            <span className="text-muted-foreground text-[11px]">System</span>
                          ) : (
                            <span className="text-emerald-600 text-[11px] font-medium">Custom</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-saffron hover:text-saffron/90"
                            onClick={() => {
                              setSelectedLedgerAccountId(acc.id)
                              setActiveTab('ledger')
                            }}
                          >
                            Ledger &rarr;
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. ACCOUNT LEDGER TAB */}
        <TabsContent value="ledger" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base sm:text-lg">Account Ledger Statement (खाता बही)</CardTitle>
                  <CardDescription>
                    Individual account statement with opening balance, chronological transactions, and running balance.
                  </CardDescription>
                </div>
              </div>

              {/* Selector and Date Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3">
                <div>
                  <Select
                    value={selectedLedgerAccountId}
                    onValueChange={setSelectedLedgerAccountId}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select Account to View..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id} className="text-xs">
                          [{acc.code}] {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={ledgerDateFrom}
                    onChange={(e) => setLedgerDateFrom(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="From Date"
                  />
                  <span className="text-muted-foreground text-xs">to</span>
                  <Input
                    type="date"
                    value={ledgerDateTo}
                    onChange={(e) => setLedgerDateTo(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="To Date"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {!selectedLedgerAccountId ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Please select an account from the dropdown above to view its statement.
                </div>
              ) : ledgerLoading ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Loading ledger transactions...
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Ledger Summary Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-lg border">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Opening Balance</p>
                      <p className="font-mono text-sm font-semibold">
                        {formatCurrency(ledgerData?.opening_balance || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Period Debit (Dr)</p>
                      <p className="font-mono text-sm font-semibold text-emerald-700">
                        {formatCurrency(ledgerData?.total_debit || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Period Credit (Cr)</p>
                      <p className="font-mono text-sm font-semibold text-amber-700">
                        {formatCurrency(ledgerData?.total_credit || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Closing Balance</p>
                      <p className="font-mono text-sm font-bold text-maroon">
                        {formatCurrency(ledgerData?.closing_balance || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Transactions Table */}
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="w-[100px]">Date</TableHead>
                          <TableHead className="w-[130px]">Voucher #</TableHead>
                          <TableHead>Particulars / Narration</TableHead>
                          <TableHead className="text-right w-[110px]">Debit (Dr)</TableHead>
                          <TableHead className="text-right w-[110px]">Credit (Cr)</TableHead>
                          <TableHead className="text-right w-[120px]">Running Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerData?.entries?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">
                              No entries found for this account in the selected period.
                            </TableCell>
                          </TableRow>
                        ) : (
                          ledgerData?.entries?.map((row) => (
                            <TableRow key={row.id} className={row.is_reversed ? 'opacity-50 line-through' : ''}>
                              <TableCell className="text-xs">
                                {new Date(row.entry_date).toLocaleDateString('en-IN')}
                              </TableCell>
                              <TableCell className="font-mono text-xs font-medium">
                                {row.entry_number}
                              </TableCell>
                              <TableCell className="text-xs">
                                {row.narration || '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-semibold text-maroon">
                                {formatCurrency(row.running_balance)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. STATUTORY REPORTS TAB */}
        <TabsContent value="statutory" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Trial Balance Card */}
            <Card className="flex flex-col justify-between border-t-4 border-t-blue-500 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Double-Entry
                  </Badge>
                  <Scale className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle className="text-base mt-2">Trial Balance (तलपट)</CardTitle>
                <CardDescription className="text-xs">
                  Account-wise period debits, credits, and closing balances. Proves mathematical accuracy of books.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs space-y-1 bg-muted/40 p-2.5 rounded">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Debits:</span>
                    <span className="font-mono font-medium">{formatCurrency(trialBalance?.totals?.period_debit || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Credits:</span>
                    <span className="font-mono font-medium">{formatCurrency(trialBalance?.totals?.period_credit || 0)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-1 border-t">
                    <span>Balance Status:</span>
                    <span className={trialBalance?.totals?.is_balanced ? 'text-emerald-600' : 'text-rose-600'}>
                      {trialBalance?.totals?.is_balanced ? 'Balanced ✓' : 'Unbalanced ✗'}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => handleExport('trial-balance')}
                >
                  <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-600" />
                  Download Excel
                </Button>
              </CardContent>
            </Card>

            {/* 2. Income & Expenditure Card */}
            <Card className="flex flex-col justify-between border-t-4 border-t-emerald-500 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                    Annual / Periodical
                  </Badge>
                  <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
                </div>
                <CardTitle className="text-base mt-2">Income & Expenditure (आय-व्यय)</CardTitle>
                <CardDescription className="text-xs">
                  Statutory Revenue Account for Charitable Trusts. Shows all donations vs trust expenditures.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs space-y-1 bg-muted/40 p-2.5 rounded">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Income:</span>
                    <span className="font-mono font-medium text-emerald-700">{formatCurrency(incomeExp?.total_income || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Expenses:</span>
                    <span className="font-mono font-medium text-rose-700">{formatCurrency(incomeExp?.total_expenditure || 0)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-1 border-t">
                    <span>{incomeExp?.is_surplus ? 'Net Surplus:' : 'Net Deficit:'}</span>
                    <span className={`font-mono ${incomeExp?.is_surplus ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatCurrency(Math.abs(incomeExp?.surplus_or_deficit || 0))}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => handleExport('income-expenditure')}
                >
                  <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-600" />
                  Download Excel
                </Button>
              </CardContent>
            </Card>

            {/* 3. Statement of Affairs (Balance Sheet) Card */}
            <Card className="flex flex-col justify-between border-t-4 border-t-purple-500 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                    Balance Sheet
                  </Badge>
                  <Landmark className="h-5 w-5 text-purple-600" />
                </div>
                <CardTitle className="text-base mt-2">Statement of Affairs (तुलन पत्र)</CardTitle>
                <CardDescription className="text-xs">
                  Trust Balance Sheet: Assets (Cash, Bank, Properties) vs Corpus Funds, Reserves & Liabilities.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs space-y-1 bg-muted/40 p-2.5 rounded">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Assets:</span>
                    <span className="font-mono font-medium text-blue-700">
                      {formatCurrency(statementOfAffairs?.assets?.total || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Corpus & Liabilities:</span>
                    <span className="font-mono font-medium text-purple-700">
                      {formatCurrency(statementOfAffairs?.funds_and_liabilities?.total || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold pt-1 border-t">
                    <span>Sheet Status:</span>
                    <span className={statementOfAffairs?.is_balanced ? 'text-emerald-600' : 'text-amber-600'}>
                      {statementOfAffairs?.is_balanced ? 'Balanced ✓' : 'Diff: ' + formatCurrency(statementOfAffairs?.difference || 0)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => handleExport('statement-of-affairs')}
                >
                  <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-600" />
                  Download Excel
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOG: VIEW JOURNAL VOUCHER DETAILS */}
      <Dialog open={Boolean(selectedVoucherForView)} onOpenChange={(open) => !open && setSelectedVoucherForView(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold text-maroon flex items-center gap-2">
                <span>Journal Voucher {selectedVoucherForView?.entry_number}</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded border ${
                    VOUCHER_TYPE_COLORS[selectedVoucherForView?.voucher_type] || ''
                  }`}
                >
                  {selectedVoucherForView?.voucher_type}
                </span>
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Date: {selectedVoucherForView?.entry_date ? new Date(selectedVoucherForView.entry_date).toLocaleDateString('en-IN') : ''} |
              Source: {selectedVoucherForView?.source_type || 'MANUAL'} |
              Created By: {selectedVoucherForView?.created_by || 'SYSTEM'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="bg-muted/40 p-2.5 rounded text-xs">
              <span className="font-semibold">Narration: </span>
              {selectedVoucherForView?.narration || 'None'}
            </div>

            <div className="border rounded overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Account</TableHead>
                    <TableHead className="text-xs">Particulars</TableHead>
                    <TableHead className="text-right text-xs w-[100px]">Debit (₹)</TableHead>
                    <TableHead className="text-right text-xs w-[100px]">Credit (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedVoucherForView?.lines?.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs font-medium">
                        [{line.account?.code}] {line.account?.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {line.narration || '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {Number(line.debit) > 0 ? formatCurrency(line.debit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {Number(line.credit) > 0 ? formatCurrency(line.credit) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2">
            <div>
              {selectedVoucherForView?.source_type === 'MANUAL' && !selectedVoucherForView?.is_reversed && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleReverseVoucher(selectedVoucherForView.id)}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Reverse Voucher
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedVoucherForView(null)}
              className="text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: CREATE MANUAL JOURNAL VOUCHER */}
      <Dialog open={isNewVoucherOpen} onOpenChange={setIsNewVoucherOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-maroon">
              Record Journal Voucher (खाता प्रविष्टि)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Create balanced multi-line double-entry voucher in accordance with trust accounting standards.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateVoucher} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Voucher Date</Label>
                <Input
                  type="date"
                  required
                  value={voucherForm.entry_date}
                  onChange={(e) => setVoucherForm({ ...voucherForm, entry_date: e.target.value })}
                  className="h-9 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Voucher Type</Label>
                <Select
                  value={voucherForm.voucher_type}
                  onValueChange={(val) => setVoucherForm({ ...voucherForm, voucher_type: val })}
                >
                  <SelectTrigger className="h-9 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="JOURNAL">Journal (JV)</SelectItem>
                    <SelectItem value="RECEIPT">Receipt (REC)</SelectItem>
                    <SelectItem value="PAYMENT">Payment (PAY)</SelectItem>
                    <SelectItem value="CONTRA">Contra (CON - Cash/Bank transfer)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Narration / Purpose (विवरण)</Label>
              <Input
                required
                placeholder="e.g. Bank interest credit / Transfer to Fixed Deposit"
                value={voucherForm.narration}
                onChange={(e) => setVoucherForm({ ...voucherForm, narration: e.target.value })}
                className="h-9 text-xs mt-1"
              />
            </div>

            {/* Dr/Cr Lines Table */}
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Account</TableHead>
                    <TableHead className="text-right text-xs w-[120px]">Debit (Dr)</TableHead>
                    <TableHead className="text-right text-xs w-[120px]">Credit (Cr)</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {voucherForm.lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="p-2">
                        <Select
                          value={line.account_id}
                          onValueChange={(val) => handleLineChange(idx, 'account_id', val)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select Account..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-56">
                            {accounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id} className="text-xs">
                                [{acc.code}] {acc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={line.debit}
                          onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                          className="h-8 text-xs font-mono text-right"
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={line.credit}
                          onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                          className="h-8 text-xs font-mono text-right"
                        />
                      </TableCell>
                      <TableCell className="p-2 text-center">
                        {voucherForm.lines.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600"
                            onClick={() => removeVoucherLine(idx)}
                          >
                            ×
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addVoucherLine}
                className="text-xs h-8"
              >
                + Add Another Line
              </Button>

              <div className="text-xs font-mono flex items-center gap-4">
                <div>
                  <span className="text-muted-foreground">Dr: </span>
                  <span className="font-semibold">{formatCurrency(voucherTotals.debit)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cr: </span>
                  <span className="font-semibold">{formatCurrency(voucherTotals.credit)}</span>
                </div>
                <div>
                  {voucherTotals.isBalanced ? (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" /> Balanced
                    </span>
                  ) : (
                    <span className="text-rose-600 font-bold flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" /> Diff: ₹{voucherTotals.diff}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewVoucherOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!voucherTotals.isBalanced || createJournalMutation.isPending}
                className="bg-saffron text-white hover:bg-saffron/90 text-xs"
              >
                {createJournalMutation.isPending ? 'Saving...' : 'Post Journal Voucher'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: CREATE CUSTOM ACCOUNT */}
      <Dialog open={isNewAccountOpen} onOpenChange={setIsNewAccountOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-maroon">
              Add New Account to Chart of Accounts
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add a specialized ledger account under Assets, Liabilities, Funds, Income, or Expenses.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAccount} className="space-y-3">
            <div>
              <Label className="text-xs">Account Code (Numeric, e.g. 1103, 4015, 5025)</Label>
              <Input
                required
                placeholder="4015"
                value={accountForm.code}
                onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                className="h-9 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Account Name (e.g. Bhandara Corpus / Mandir Sound System)</Label>
              <Input
                required
                placeholder="Sound System & Speaker Asset"
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                className="h-9 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Account Classification</Label>
              <Select
                value={accountForm.account_type}
                onValueChange={(val) => {
                  const normal = ['ASSET', 'EXPENSE'].includes(val) ? 'DEBIT' : 'CREDIT'
                  setAccountForm({ ...accountForm, account_type: val, normal_balance: normal })
                }}
              >
                <SelectTrigger className="h-9 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSET">Asset (संपत्ति)</SelectItem>
                  <SelectItem value="LIABILITY">Liability (देयता)</SelectItem>
                  <SelectItem value="CORPUS">Corpus & Earmarked Fund (स्थायी निधि)</SelectItem>
                  <SelectItem value="INCOME">Income (आय)</SelectItem>
                  <SelectItem value="EXPENSE">Expense (व्यय)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Description (Optional)</Label>
              <Input
                placeholder="Specific fund or expense description..."
                value={accountForm.description}
                onChange={(e) => setAccountForm({ ...accountForm, description: e.target.value })}
                className="h-9 text-xs mt-1"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewAccountOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createAccountMutation.isPending}
                className="bg-saffron text-white hover:bg-saffron/90 text-xs"
              >
                {createAccountMutation.isPending ? 'Creating...' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
