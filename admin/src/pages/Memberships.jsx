import { useMemo, useState } from 'react'
import { BadgeCheck, Plus, Users } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import FilterToolbar from '@/components/common/FilterToolbar'
import CompactStatCard from '@/components/common/CompactStatCard'
import EmptyState from '@/components/common/EmptyState'
import TableLoadingSkeleton from '@/components/common/TableLoadingSkeleton'
import RequiredLabel from '@/components/common/RequiredLabel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  useCommitmentMembers,
  useCommitmentSummary,
  useEnrollMember,
  useLifetimePlan,
  useRecordMembershipPayment,
  useUpdateLifetimePlan,
  useUpdateMemberStatus,
} from '@/hooks/useCommitments'
import { formatCurrency, formatPaymentMode, todayISO } from '@/utils/formatters'
import { getApiErrorMessage } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

const PAYMENT_MODES = ['CASH', 'UPI', 'CHEQUE', 'NEFT', 'RTGS', 'DD', 'ONLINE']

export default function Memberships() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const params = useMemo(
    () => ({
      page: 1,
      limit: 50,
      search: search || undefined,
      status: status === 'all' ? undefined : status,
    }),
    [search, status]
  )

  const { data: planData } = useLifetimePlan()
  const { data: summaryData } = useCommitmentSummary()
  const { data, isLoading, isError, error } = useCommitmentMembers(params)
  const enroll = useEnrollMember()
  const updatePlan = useUpdateLifetimePlan()
  const updateStatus = useUpdateMemberStatus()

  const [enrollOpen, setEnrollOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)

  const [enrollForm, setEnrollForm] = useState({
    name: '',
    mobile: '',
    city: '',
    start_date: todayISO(),
    notes: '',
  })
  const [planForm, setPlanForm] = useState({ total_amount: '110000', tenure_months: '36', title: 'Lifetime Membership' })
  const [payForm, setPayForm] = useState({
    amount: '',
    payment_date: todayISO(),
    payment_mode: 'CASH',
    upi_ref: '',
    cheque_number: '',
    bank_ref: '',
    notes: '',
  })

  const recordPayment = useRecordMembershipPayment(selectedMember?.id)

  const openPlan = () => {
    const p = planData?.plan
    setPlanForm({
      total_amount: String(p?.total_amount ?? 110000),
      tenure_months: String(p?.tenure_months ?? 36),
      title: p?.title || 'Lifetime Membership',
    })
    setPlanOpen(true)
  }

  const openPay = (member) => {
    setSelectedMember(member)
    setPayForm({
      amount: String(member.amount_pending || ''),
      payment_date: todayISO(),
      payment_mode: 'CASH',
      upi_ref: '',
      cheque_number: '',
      bank_ref: '',
      notes: '',
    })
    setPayOpen(true)
  }

  const submitEnroll = async (e) => {
    e.preventDefault()
    try {
      await enroll.mutateAsync(enrollForm)
      toast({ title: 'Member enrolled' })
      setEnrollOpen(false)
      setEnrollForm({ name: '', mobile: '', city: '', start_date: todayISO(), notes: '' })
    } catch (err) {
      toast({ title: 'Enrollment failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const submitPlan = async (e) => {
    e.preventDefault()
    try {
      await updatePlan.mutateAsync({
        title: planForm.title,
        total_amount: Number(planForm.total_amount),
        tenure_months: Number(planForm.tenure_months),
        is_active: true,
      })
      toast({ title: 'Lifetime plan saved' })
      setPlanOpen(false)
    } catch (err) {
      toast({ title: 'Could not save plan', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const submitPay = async (e) => {
    e.preventDefault()
    try {
      const result = await recordPayment.mutateAsync({
        ...payForm,
        amount: Number(payForm.amount),
      })
      toast({
        title: 'Payment recorded',
        description: result.donation?.receipt_number
          ? `Donation receipt ${result.donation.receipt_number}`
          : 'Membership balance updated',
      })
      setPayOpen(false)
    } catch (err) {
      toast({ title: 'Payment failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const summary = summaryData?.summary
  const plan = planData?.plan || summaryData?.plan

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lifetime Membership"
        description="One commitment plan for all lifetime members — track paid vs pending and issue normal donation receipts on each payment."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openPlan}>Plan settings</Button>
            <Button onClick={() => setEnrollOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Enroll member
            </Button>
          </div>
        }
      />

      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
          <div>
            <p className="font-medium">{plan?.title || 'Lifetime Membership'}</p>
            <p className="text-muted-foreground">
              Commitment {formatCurrency(plan?.total_amount || 0)} over {plan?.tenure_months || '—'} months
            </p>
          </div>
          <BadgeCheck className="h-5 w-5 text-primary" />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CompactStatCard label="Members" value={summary?.members_total ?? 0} />
        <CompactStatCard label="Collected" value={formatCurrency(summary?.amount_collected || 0)} />
        <CompactStatCard label="Pending" value={formatCurrency(summary?.amount_pending || 0)} />
        <CompactStatCard label="Overdue" value={summary?.members_overdue ?? 0} />
      </div>

      <FilterToolbar>
        <Input placeholder="Search name / mobile / city" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </FilterToolbar>

      {isError ? (
        <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
      ) : isLoading ? (
        <TableLoadingSkeleton rows={6} />
      ) : !(data?.members || []).length ? (
        <EmptyState icon={Users} title="No members yet" description="Set the lifetime plan amount/tenure, then enroll members." />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Committed</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.members || []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.mobile}{m.city ? ` · ${m.city}` : ''}
                        {m.is_overdue ? ' · Overdue' : ''}
                      </p>
                    </TableCell>
                    <TableCell>{m.status}</TableCell>
                    <TableCell className="text-right">{formatCurrency(m.amount_committed)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(m.amount_paid)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(m.amount_pending)}</TableCell>
                    <TableCell className="text-right">{m.percent_paid}%</TableCell>
                    <TableCell className="text-right space-x-1">
                      {m.status === 'ACTIVE' && m.amount_pending > 0 ? (
                        <Button size="sm" variant="outline" onClick={() => openPay(m)}>Pay</Button>
                      ) : null}
                      {m.status === 'ACTIVE' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await updateStatus.mutateAsync({ id: m.id, status: 'CANCELLED' })
                              toast({ title: 'Member cancelled' })
                            } catch (err) {
                              toast({ title: 'Update failed', description: getApiErrorMessage(err), variant: 'destructive' })
                            }
                          }}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enroll lifetime member</DialogTitle></DialogHeader>
          <form onSubmit={submitEnroll} className="space-y-3">
            <div>
              <RequiredLabel>Name</RequiredLabel>
              <Input value={enrollForm.name} onChange={(e) => setEnrollForm({ ...enrollForm, name: e.target.value })} required />
            </div>
            <div>
              <RequiredLabel>Mobile</RequiredLabel>
              <Input value={enrollForm.mobile} onChange={(e) => setEnrollForm({ ...enrollForm, mobile: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>City</Label>
                <Input value={enrollForm.city} onChange={(e) => setEnrollForm({ ...enrollForm, city: e.target.value })} />
              </div>
              <div>
                <RequiredLabel>Start date</RequiredLabel>
                <Input type="date" value={enrollForm.start_date} onChange={(e) => setEnrollForm({ ...enrollForm, start_date: e.target.value })} required />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={enrollForm.notes} onChange={(e) => setEnrollForm({ ...enrollForm, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={enroll.isPending}>Enroll</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lifetime plan (applies to all members)</DialogTitle></DialogHeader>
          <form onSubmit={submitPlan} className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={planForm.title} onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <RequiredLabel>Total amount (₹)</RequiredLabel>
                <Input type="number" min="1" value={planForm.total_amount} onChange={(e) => setPlanForm({ ...planForm, total_amount: e.target.value })} required />
              </div>
              <div>
                <RequiredLabel>Tenure (months)</RequiredLabel>
                <Input type="number" min="1" max="120" value={planForm.tenure_months} onChange={(e) => setPlanForm({ ...planForm, tenure_months: e.target.value })} required />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Example: ₹1,10,000 within 36 months. Existing members keep tracking against this plan total.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPlanOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updatePlan.isPending}>Save plan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment{selectedMember ? ` — ${selectedMember.name}` : ''}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitPay} className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Pending: {formatCurrency(selectedMember?.amount_pending || 0)}. Creates a normal donation receipt.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <RequiredLabel>Amount</RequiredLabel>
                <Input type="number" min="1" step="any" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} required />
              </div>
              <div>
                <RequiredLabel>Date</RequiredLabel>
                <Input type="date" value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} required />
              </div>
            </div>
            <div>
              <RequiredLabel>Payment mode</RequiredLabel>
              <Select value={payForm.payment_mode} onValueChange={(v) => setPayForm({ ...payForm, payment_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>{formatPaymentMode(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {payForm.payment_mode === 'UPI' ? (
              <div>
                <Label>UPI ref</Label>
                <Input value={payForm.upi_ref} onChange={(e) => setPayForm({ ...payForm, upi_ref: e.target.value })} />
              </div>
            ) : null}
            {payForm.payment_mode === 'CHEQUE' ? (
              <div>
                <Label>Cheque no.</Label>
                <Input value={payForm.cheque_number} onChange={(e) => setPayForm({ ...payForm, cheque_number: e.target.value })} />
              </div>
            ) : null}
            {['NEFT', 'RTGS', 'ONLINE', 'DD'].includes(payForm.payment_mode) ? (
              <div>
                <Label>Bank ref</Label>
                <Input value={payForm.bank_ref} onChange={(e) => setPayForm({ ...payForm, bank_ref: e.target.value })} />
              </div>
            ) : null}
            <div>
              <Label>Notes</Label>
              <Textarea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={recordPayment.isPending}>Save payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
