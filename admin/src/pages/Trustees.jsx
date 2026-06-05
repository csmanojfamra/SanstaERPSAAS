import { useState } from 'react'
import { Plus, IndianRupee, MoreVertical, Landmark, ShieldCheck, Phone, Mail } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmActionDialog from '@/components/common/ConfirmActionDialog'
import EmptyState from '@/components/common/EmptyState'
import {
  useTrustees,
  useCreateTrustee,
  useUpdateTrustee,
  useDeleteTrustee,
  useCreateContribution,
} from '@/hooks/useTrustees'
import { formatCurrency, formatDate, formatPaymentMode, todayISO } from '@/utils/formatters'
import { getApiErrorMessage } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { useAuthStore } from '@/store/useAuthStore'

const PAYMENT_MODES = ['CASH', 'UPI', 'CHEQUE', 'NEFT', 'RTGS', 'DD', 'ONLINE']
const TRUSTEE_ROLE_OPTIONS = [
  'President',
  'Vice President',
  'Secretary',
  'Joint Secretary',
  'Treasurer',
  'Managing Trustee',
  'Trustee',
  'Committee Member',
  'Advisor',
  'Auditor',
  'Volunteer Coordinator',
  'Other',
]
const ROLE_BADGE_CLASS = {
  President: 'bg-maroon text-white border-transparent',
  'Vice President': 'bg-maroon/90 text-white border-transparent',
  Secretary: 'bg-blue-600 text-white border-transparent',
  'Joint Secretary': 'bg-blue-500 text-white border-transparent',
  Treasurer: 'bg-saffron text-white border-transparent',
  'Managing Trustee': 'bg-gold text-maroon border-transparent',
  Trustee: 'bg-muted text-foreground border-border',
}
const INDIAN_STATES_UT = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
]
const CITIES_BY_STATE = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool'],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Bomdila'],
  Assam: ['Guwahati', 'Dibrugarh', 'Silchar', 'Tezpur', 'Jorhat'],
  Bihar: ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga'],
  Chhattisgarh: ['Raipur', 'Bhilai', 'Bilaspur', 'Durg', 'Korba'],
  Goa: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'],
  Haryana: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Hisar'],
  'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Mandi', 'Solan', 'Una'],
  Jharkhand: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi'],
  Kerala: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kannur'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad'],
  Manipur: ['Imphal', 'Thoubal', 'Bishnupur', 'Ukhrul', 'Churachandpur'],
  Meghalaya: ['Shillong', 'Tura', 'Jowai', 'Nongpoh', 'Baghmara'],
  Mizoram: ['Aizawl', 'Lunglei', 'Champhai', 'Kolasib', 'Serchhip'],
  Nagaland: ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha'],
  Odisha: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Sambalpur', 'Puri'],
  Punjab: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Mohali'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
  Sikkim: ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan', 'Rangpo'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
  Tripura: ['Agartala', 'Udaipur', 'Dharmanagar', 'Kailashahar', 'Belonia'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Varanasi', 'Prayagraj', 'Agra'],
  Uttarakhand: ['Dehradun', 'Haridwar', 'Haldwani', 'Roorkee', 'Rudrapur'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri'],
  'Andaman and Nicobar Islands': ['Port Blair'],
  Chandigarh: ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Diu', 'Silvassa'],
  Delhi: ['New Delhi', 'Delhi', 'Dwarka', 'Rohini', 'Karol Bagh'],
  'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Kathua'],
  Ladakh: ['Leh', 'Kargil'],
  Lakshadweep: ['Kavaratti'],
  Puducherry: ['Puducherry', 'Karaikal', 'Mahe', 'Yanam'],
}

export default function Trustees() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN')
  const { data, isLoading, isError, error } = useTrustees()
  const createTrustee = useCreateTrustee()
  const updateTrustee = useUpdateTrustee()
  const deleteTrustee = useDeleteTrustee()
  const createContribution = useCreateContribution()

  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [selectedTrustee, setSelectedTrustee] = useState(null)
  const [contribOpen, setContribOpen] = useState(null)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [viewMode, setViewMode] = useState('board')
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false)
  const [trusteeForm, setTrusteeForm] = useState({
    name: '',
    role: 'Trustee',
    mobile: '',
    email: '',
    joining_date: '',
    pan_number: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    notes: '',
    authorized_signatory: false,
    bank_signatory: false,
    is_active: true,
    display_order: 0,
  })
  const [contribForm, setContribForm] = useState({
    amount: '',
    contribution_date: todayISO(),
    payment_mode: 'CASH',
    remarks: '',
  })
  const cityOptions = CITIES_BY_STATE[trusteeForm.state] || []
  const filteredStates = INDIAN_STATES_UT.filter((stateName) =>
    stateName.toLowerCase().includes((trusteeForm.state || '').toLowerCase())
  )

  const handleAddTrustee = async () => {
    try {
      if (trusteeForm.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(trusteeForm.pan_number)) {
        toast({
          title: 'Invalid PAN',
          description: 'Please enter a valid PAN (e.g. ABCDE1234F)',
          variant: 'destructive',
        })
        return
      }
      if (trusteeForm.pincode && !/^\d{6}$/.test(trusteeForm.pincode)) {
        toast({
          title: 'Invalid pincode',
          description: 'Pincode must be 6 digits',
          variant: 'destructive',
        })
        return
      }
      await createTrustee.mutateAsync(trusteeForm)
      toast({ title: 'Trustee added' })
      setAddOpen(false)
      setTrusteeForm({
        name: '',
        role: 'Trustee',
        mobile: '',
        email: '',
        joining_date: '',
        pan_number: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        pincode: '',
        notes: '',
        authorized_signatory: false,
        bank_signatory: false,
        is_active: true,
        display_order: 0,
      })
    } catch (err) {
      toast({ title: 'Failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleContrib = async () => {
    try {
      await createContribution.mutateAsync({
        trusteeId: contribOpen.id,
        amount: parseFloat(contribForm.amount),
        contribution_date: contribForm.contribution_date,
        payment_mode: contribForm.payment_mode,
        remarks: contribForm.remarks || undefined,
      })
      toast({ title: 'Contribution recorded' })
      setContribOpen(null)
      setContribForm({ amount: '', contribution_date: todayISO(), payment_mode: 'CASH', remarks: '' })
    } catch (err) {
      toast({ title: 'Failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleDelete = async (id) => {
    setPendingDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    try {
      await deleteTrustee.mutateAsync(pendingDeleteId)
      toast({ title: 'Trustee removed' })
      setPendingDeleteId(null)
    } catch (err) {
      toast({ title: 'Cannot delete', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const openProfile = (trustee) => {
    setSelectedTrustee(trustee)
    setProfileOpen(true)
  }

  const openEdit = (trustee) => {
    setSelectedTrustee(trustee)
    setTrusteeForm({
      name: trustee.name || '',
      role: trustee.role || 'Trustee',
      mobile: trustee.mobile || '',
      email: trustee.email || '',
      joining_date: trustee.joining_date ? String(trustee.joining_date).slice(0, 10) : '',
      pan_number: trustee.pan_number || '',
      address_line1: trustee.address_line1 || '',
      address_line2: trustee.address_line2 || '',
      city: trustee.city || '',
      state: trustee.state || '',
      pincode: trustee.pincode || '',
      notes: trustee.notes || '',
      authorized_signatory: Boolean(trustee.authorized_signatory),
      bank_signatory: Boolean(trustee.bank_signatory),
      is_active: trustee.is_active !== false,
      display_order: trustee.display_order ?? 0,
    })
    setEditOpen(true)
  }

  const handleUpdateTrustee = async () => {
    if (!selectedTrustee) return
    try {
      if (trusteeForm.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(trusteeForm.pan_number)) {
        toast({
          title: 'Invalid PAN',
          description: 'Please enter a valid PAN (e.g. ABCDE1234F)',
          variant: 'destructive',
        })
        return
      }
      if (trusteeForm.pincode && !/^\d{6}$/.test(trusteeForm.pincode)) {
        toast({
          title: 'Invalid pincode',
          description: 'Pincode must be 6 digits',
          variant: 'destructive',
        })
        return
      }
      await updateTrustee.mutateAsync({ id: selectedTrustee.id, ...trusteeForm })
      toast({ title: 'Trustee updated' })
      setEditOpen(false)
      setSelectedTrustee(null)
    } catch (err) {
      toast({ title: 'Update failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  return (
    <>
      <PageHeader title="Trust Governance" description="Manage office bearers, trustees and governance roles.">
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-lg border bg-background p-1">
            <Button
              variant={viewMode === 'board' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('board')}
            >
              Board View
            </Button>
            <Button
              variant={viewMode === 'register' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('register')}
            >
              Register View
            </Button>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Office Bearer
          </Button>
        </div>
      </PageHeader>

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error?.message}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : !data?.trustees?.length ? (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <EmptyState
              title="No trustees added yet"
              description="Add office bearers and governance members to begin managing trust operations."
            />
            <div className="mt-2 flex justify-center">
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Office Bearer
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === 'board' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.trustees.map((t) => (
                <Card key={t.id} className="border-border/80">
                  <CardHeader className="space-y-2 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge className={ROLE_BADGE_CLASS[t.role] || 'bg-muted text-foreground border-border'}>
                        {(t.role || 'Trustee').toUpperCase()} · ACTIVE
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="More trustee actions">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openProfile(t)}>
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(t)}>
                            Edit Trustee
                          </DropdownMenuItem>
                          {isAdmin ? (
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(t.id)}>
                              Deactivate Trustee
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardTitle className="text-lg leading-tight">{t.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Joining Date: {t.joining_date ? formatDate(t.joining_date) : 'Not specified'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {t.authorized_signatory ? (
                        <Badge variant="outline" className="text-[11px]"><ShieldCheck className="mr-1 h-3 w-3" />Authorized Signatory</Badge>
                      ) : null}
                      {t.bank_signatory ? (
                        <Badge variant="outline" className="text-[11px]"><Landmark className="mr-1 h-3 w-3" />Bank Signatory</Badge>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-lg border border-border/70 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contact Info</p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        {t.mobile || 'Mobile not added'}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {t.email || 'Email not added'}
                      </p>
                    </div>

                    <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contribution Summary</p>
                      <p className="mt-1 text-xl font-semibold text-maroon">{formatCurrency(t.total_contributions)}</p>
                      <p className="text-sm font-medium">{t.contribution_count} Contributions</p>
                      <p className="text-xs text-muted-foreground">
                        Last Contribution: {t.last_contribution_date ? formatDate(t.last_contribution_date) : 'No contribution yet'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => openProfile(t)}>
                        View Profile
                      </Button>
                      <Button size="sm" onClick={() => setContribOpen(t)}>
                        Add Contribution
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead className="text-right">Contributions</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.trustees.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>
                            <Badge className={ROLE_BADGE_CLASS[t.role] || 'bg-muted text-foreground border-border'}>
                              {t.role || 'Trustee'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline">Active</Badge>
                              {t.authorized_signatory ? <Badge variant="outline">Authorized</Badge> : null}
                              {t.bank_signatory ? <Badge variant="outline">Bank Signatory</Badge> : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <p>{t.mobile || '—'}</p>
                            <p className="text-muted-foreground">{t.email || '—'}</p>
                          </TableCell>
                          <TableCell className="text-right">
                            <p className="font-semibold">{formatCurrency(t.total_contributions)}</p>
                            <p className="text-xs text-muted-foreground">{t.contribution_count} count</p>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => openProfile(t)}>
                                Profile
                              </Button>
                              <Button size="sm" onClick={() => setContribOpen(t)}>
                                Add
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="More trustee actions">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEdit(t)}>
                                    Edit Trustee
                                  </DropdownMenuItem>
                                  {isAdmin ? (
                                    <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(t.id)}>
                                      Deactivate Trustee
                                    </DropdownMenuItem>
                                  ) : null}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Register Office Bearer</DialogTitle>
            <DialogDescription>
              Add governance and contact details for trustee and committee role management.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Basic Information</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Full Name *</Label>
                  <Input value={trusteeForm.name} onChange={(e) => setTrusteeForm({ ...trusteeForm, name: e.target.value })} />
                </div>
                <div>
                  <Label>Role *</Label>
                  <Select value={trusteeForm.role} onValueChange={(v) => setTrusteeForm({ ...trusteeForm, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRUSTEE_ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mobile Number</Label>
                  <Input value={trusteeForm.mobile} onChange={(e) => setTrusteeForm({ ...trusteeForm, mobile: e.target.value })} maxLength={10} />
                </div>
                <div>
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    value={trusteeForm.email}
                    onChange={(e) => setTrusteeForm({ ...trusteeForm, email: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-foreground">Governance Details</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Joining Date</Label>
                  <Input
                    type="date"
                    max={todayISO()}
                    value={trusteeForm.joining_date}
                    onChange={(e) => setTrusteeForm({ ...trusteeForm, joining_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      checked={trusteeForm.authorized_signatory}
                      onChange={(e) => setTrusteeForm({ ...trusteeForm, authorized_signatory: e.target.checked })}
                    />
                    <span>Authorized Signatory</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      checked={trusteeForm.bank_signatory}
                      onChange={(e) => setTrusteeForm({ ...trusteeForm, bank_signatory: e.target.checked })}
                    />
                    <span>Bank Signatory</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      checked={trusteeForm.is_active}
                      onChange={(e) => setTrusteeForm({ ...trusteeForm, is_active: e.target.checked })}
                    />
                    <span>Active Trustee</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-foreground">Additional Details</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>PAN Number</Label>
                  <Input
                    value={trusteeForm.pan_number}
                    onChange={(e) => setTrusteeForm({ ...trusteeForm, pan_number: e.target.value.toUpperCase() })}
                    placeholder="ABCDE1234F"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Address Line 1</Label>
                  <Input
                    value={trusteeForm.address_line1}
                    onChange={(e) => setTrusteeForm({ ...trusteeForm, address_line1: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Address Line 2</Label>
                  <Input
                    value={trusteeForm.address_line2}
                    onChange={(e) => setTrusteeForm({ ...trusteeForm, address_line2: e.target.value })}
                  />
                </div>
                <div>
                  <Label>State</Label>
                  <div className="relative">
                    <Input
                      value={trusteeForm.state}
                      placeholder="Search and select state/UT"
                      onFocus={() => setStateDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setStateDropdownOpen(false), 120)}
                      onChange={(e) => {
                        setTrusteeForm({ ...trusteeForm, state: e.target.value, city: '' })
                        setStateDropdownOpen(true)
                      }}
                    />
                    {stateDropdownOpen ? (
                      <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
                        {filteredStates.length ? (
                          filteredStates.map((stateName) => (
                            <button
                              key={stateName}
                              type="button"
                              className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setTrusteeForm({ ...trusteeForm, state: stateName, city: '' })
                                setStateDropdownOpen(false)
                              }}
                            >
                              {stateName}
                            </button>
                          ))
                        ) : (
                          <p className="px-2 py-1.5 text-sm text-muted-foreground">No matching state found</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div>
                  <Label>City</Label>
                  <Select
                    value={trusteeForm.city || 'none'}
                    onValueChange={(v) =>
                      setTrusteeForm({ ...trusteeForm, city: v === 'none' ? '' : v })
                    }
                    disabled={!trusteeForm.state}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          trusteeForm.state
                            ? 'Select city'
                            : 'Select state first'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {cityOptions.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pincode</Label>
                  <Input
                    value={trusteeForm.pincode}
                    maxLength={6}
                    inputMode="numeric"
                    onChange={(e) => setTrusteeForm({ ...trusteeForm, pincode: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={trusteeForm.notes}
                    onChange={(e) => setTrusteeForm({ ...trusteeForm, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddTrustee}
                disabled={!trusteeForm.name || !trusteeForm.role || createTrustee.isPending}
              >
                {createTrustee.isPending ? 'Saving Trustee...' : 'Save Trustee'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => !open && setEditOpen(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Office Bearer</DialogTitle>
            <DialogDescription>
              Update governance and contact details for this trustee.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Basic Information</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Full Name *</Label>
                  <Input value={trusteeForm.name} onChange={(e) => setTrusteeForm({ ...trusteeForm, name: e.target.value })} />
                </div>
                <div>
                  <Label>Role *</Label>
                  <Select value={trusteeForm.role} onValueChange={(v) => setTrusteeForm({ ...trusteeForm, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRUSTEE_ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mobile Number</Label>
                  <Input value={trusteeForm.mobile} onChange={(e) => setTrusteeForm({ ...trusteeForm, mobile: e.target.value })} maxLength={10} />
                </div>
                <div>
                  <Label>Email Address</Label>
                  <Input type="email" value={trusteeForm.email} onChange={(e) => setTrusteeForm({ ...trusteeForm, email: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-foreground">Governance Details</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Joining Date</Label>
                  <Input type="date" max={todayISO()} value={trusteeForm.joining_date} onChange={(e) => setTrusteeForm({ ...trusteeForm, joining_date: e.target.value })} />
                </div>
                <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-0.5 h-4 w-4" checked={trusteeForm.authorized_signatory} onChange={(e) => setTrusteeForm({ ...trusteeForm, authorized_signatory: e.target.checked })} />
                    <span>Authorized Signatory</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-0.5 h-4 w-4" checked={trusteeForm.bank_signatory} onChange={(e) => setTrusteeForm({ ...trusteeForm, bank_signatory: e.target.checked })} />
                    <span>Bank Signatory</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-0.5 h-4 w-4" checked={trusteeForm.is_active} onChange={(e) => setTrusteeForm({ ...trusteeForm, is_active: e.target.checked })} />
                    <span>Active Trustee</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-foreground">Additional Details</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>PAN Number</Label>
                  <Input value={trusteeForm.pan_number} onChange={(e) => setTrusteeForm({ ...trusteeForm, pan_number: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Address Line 1</Label>
                  <Input value={trusteeForm.address_line1} onChange={(e) => setTrusteeForm({ ...trusteeForm, address_line1: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Address Line 2</Label>
                  <Input value={trusteeForm.address_line2} onChange={(e) => setTrusteeForm({ ...trusteeForm, address_line2: e.target.value })} />
                </div>
                <div>
                  <Label>State</Label>
                  <div className="relative">
                    <Input
                      value={trusteeForm.state}
                      placeholder="Search and select state/UT"
                      onFocus={() => setStateDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setStateDropdownOpen(false), 120)}
                      onChange={(e) => {
                        setTrusteeForm({ ...trusteeForm, state: e.target.value, city: '' })
                        setStateDropdownOpen(true)
                      }}
                    />
                    {stateDropdownOpen ? (
                      <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
                        {filteredStates.length ? (
                          filteredStates.map((stateName) => (
                            <button
                              key={stateName}
                              type="button"
                              className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setTrusteeForm({ ...trusteeForm, state: stateName, city: '' })
                                setStateDropdownOpen(false)
                              }}
                            >
                              {stateName}
                            </button>
                          ))
                        ) : (
                          <p className="px-2 py-1.5 text-sm text-muted-foreground">No matching state found</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div>
                  <Label>City</Label>
                  <Select value={trusteeForm.city || 'none'} onValueChange={(v) => setTrusteeForm({ ...trusteeForm, city: v === 'none' ? '' : v })} disabled={!trusteeForm.state}>
                    <SelectTrigger><SelectValue placeholder={trusteeForm.state ? 'Select city' : 'Select state first'} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {cityOptions.map((city) => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pincode</Label>
                  <Input value={trusteeForm.pincode} maxLength={6} inputMode="numeric" onChange={(e) => setTrusteeForm({ ...trusteeForm, pincode: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Notes</Label>
                  <Textarea value={trusteeForm.notes} onChange={(e) => setTrusteeForm({ ...trusteeForm, notes: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTrustee} disabled={!trusteeForm.name || !trusteeForm.role || updateTrustee.isPending}>
                {updateTrustee.isPending ? 'Saving Changes...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Trustee Profile</DialogTitle>
            <DialogDescription>Governance profile and contribution summary.</DialogDescription>
          </DialogHeader>
          {selectedTrustee ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Governance Status</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[11px]">Active Trustee</Badge>
                  {selectedTrustee.authorized_signatory ? (
                    <Badge variant="outline" className="text-[11px]">
                      <ShieldCheck className="mr-1 h-3 w-3" />
                      Authorized Signatory
                    </Badge>
                  ) : null}
                  {selectedTrustee.bank_signatory ? (
                    <Badge variant="outline" className="text-[11px]">
                      <Landmark className="mr-1 h-3 w-3" />
                      Bank Signatory
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Role</p><p className="font-medium">{selectedTrustee.role || 'Trustee'}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Joining Date</p><p className="font-medium">{selectedTrustee.joining_date ? formatDate(selectedTrustee.joining_date) : 'Not specified'}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Mobile</p><p className="font-medium">{selectedTrustee.mobile || '—'}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{selectedTrustee.email || '—'}</p></div>
              <div className="rounded-lg border p-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="font-medium">
                  {[selectedTrustee.address_line1, selectedTrustee.address_line2, selectedTrustee.city, selectedTrustee.state, selectedTrustee.pincode].filter(Boolean).join(', ') || 'Not specified'}
                </p>
              </div>
              <div className="rounded-lg border p-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Contribution Summary</p>
                <p className="text-lg font-semibold text-maroon">{formatCurrency(selectedTrustee.total_contributions)}</p>
                <p>{selectedTrustee.contribution_count} contribution(s)</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!contribOpen} onOpenChange={(open) => !open && setContribOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Contribution</DialogTitle>
            <DialogDescription>{contribOpen?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div><Label>Amount *</Label><Input type="number" value={contribForm.amount} onChange={(e) => setContribForm({ ...contribForm, amount: e.target.value })} /></div>
            <div><Label>Date *</Label><Input type="date" value={contribForm.contribution_date} onChange={(e) => setContribForm({ ...contribForm, contribution_date: e.target.value })} /></div>
            <div>
              <Label>Payment mode</Label>
              <Select value={contribForm.payment_mode} onValueChange={(v) => setContribForm({ ...contribForm, payment_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>{formatPaymentMode(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleContrib} disabled={!contribForm.amount || createContribution.isPending}>Record</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Remove trustee?"
        description="This deactivates the trustee. Trustees with contribution records cannot be removed."
        confirmText="Remove trustee"
        loading={deleteTrustee.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
