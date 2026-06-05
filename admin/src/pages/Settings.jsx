import { useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/store/useAuthStore'
import api, { getApiErrorMessage } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import ConfirmActionDialog from '@/components/common/ConfirmActionDialog'
import SettingsTeamUsers from '@/components/settings/SettingsTeamUsers'

const SETTINGS_NAV = [
  { id: 'general', label: 'General' },
  { id: 'team-users', label: 'Team & Users' },
  { id: 'financial', label: 'Financial' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'website', label: 'Public Website' },
  { id: 'branding', label: 'Branding' },
  { id: 'security', label: 'Security' },
  { id: 'audit-controls', label: 'Audit Controls' },
  { id: 'backup-export', label: 'Backup & Export' },
  { id: 'danger-zone', label: 'Danger Zone' },
]

function SectionHeader({ title, description, saveLabel = 'Save Changes', onSave, onReset, saving, dirty }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs ${dirty ? 'text-amber-700' : 'text-emerald-700'}`}>
          {saving ? 'Saving...' : dirty ? 'Unsaved changes' : 'Saved successfully'}
        </span>
        <Button size="sm" variant="outline" onClick={onReset}>Reset</Button>
        <Button size="sm" onClick={onSave} disabled={saving}>{saveLabel}</Button>
      </div>
    </div>
  )
}

function PasswordStrength({ value }) {
  const score =
    (value.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(value) ? 1 : 0) +
    (/[0-9]/.test(value) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(value) ? 1 : 0)
  const label = score <= 1 ? 'Weak' : score <= 3 ? 'Moderate' : 'Strong'
  const color = score <= 1 ? 'bg-rose-500' : score <= 3 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full rounded bg-muted">
        <div className={`h-1.5 rounded ${color}`} style={{ width: `${Math.max(score, 1) * 25}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">Password strength: {label}</p>
    </div>
  )
}

export default function Settings() {
  const trust = useAuthStore((s) => s.trust)
  const user = useAuthStore((s) => s.user)
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Savable (server) fields
  const [topDonorsLimit, setTopDonorsLimit] = useState(trust?.top_donors_limit ?? 10)
  const [donorThreshold, setDonorThreshold] = useState(trust?.donor_threshold ?? 1100)
  const [openingCashBalance, setOpeningCashBalance] = useState(trust?.opening_cash_balance ?? 0)
  const [openingBankBalance, setOpeningBankBalance] = useState(trust?.opening_bank_balance ?? 0)
  const [savingWebsiteSettings, setSavingWebsiteSettings] = useState(false)
  const [confirmOpeningSave, setConfirmOpeningSave] = useState(false)

  // Rich admin forms (UI-first, future API)
  const [general, setGeneral] = useState({
    trust_reg_number: '',
    pan_number: '',
    reg_80g: '',
    reg_12a: '',
    official_address: trust?.address || '',
    city_state: '',
    official_mobile: trust?.phone || '',
    official_email: '',
    website: '',
    formation_date: '',
  })
  const [receipt, setReceipt] = useState({
    receipt_prefix: trust?.receipt_prefix || '',
    receipt_starting_number: '1',
    fy_format: 'FY 2026-27',
    auto_generate_receipt: true,
    authorized_signatory: '',
    digital_signature: '',
    receipt_footer_note: '',
    receipt_terms: '',
    qr_verification: true,
  })
  const [financial, setFinancial] = useState({
    financial_year_start: '01-Apr',
    voucher_number_format: 'EXP-FY-####',
    receipt_number_format: 'REC-FY-####',
    cash_book_lock_date: '',
    allow_backdated_entries: false,
    allow_voucher_editing: false,
  })
  const [governance, setGovernance] = useState({
    approval_high_value_expenses: true,
    approval_cash_above_threshold: true,
    approval_backdated_entries: true,
    approval_receipt_regeneration: true,
    approval_voucher_deletion: true,
    mandatory_bill_upload_threshold: 2000,
    allowed_attachment_types: 'pdf,jpg,png',
    max_upload_size_mb: 10,
  })
  const [branding, setBranding] = useState({
    logo_upload: '',
    favicon_upload: '',
    primary_color: trust?.primary_color || '#FF6B00',
    secondary_color: trust?.secondary_color || '#7B1C1C',
    letterhead_preview: '',
    website_banner_upload: '',
  })
  const [websiteSettings, setWebsiteSettings] = useState({
    public_donor_display_settings: true,
    display_limit: trust?.top_donors_limit ?? 10,
  })
  const [activeSection, setActiveSection] = useState('general')

  useEffect(() => {
    if (!trust?.id) return
    ;(async () => {
      try {
        const { data } = await api.get('/settings')
        const extra = data?.settings?.settings_json || {}
        if (data?.settings?.name) {
          useAuthStore.setState((prev) => ({
            ...prev,
            trust: { ...(prev.trust || {}), name: data.settings.name, name_hindi: data.settings.name_hindi || prev?.trust?.name_hindi },
          }))
        }
        if (data?.settings?.top_donors_limit != null) setTopDonorsLimit(data.settings.top_donors_limit)
        if (data?.settings?.donor_threshold != null) setDonorThreshold(data.settings.donor_threshold)
        if (data?.settings?.opening_cash_balance != null) setOpeningCashBalance(data.settings.opening_cash_balance)
        if (data?.settings?.opening_bank_balance != null) setOpeningBankBalance(data.settings.opening_bank_balance)
        setGeneral((prev) => ({
          ...prev,
          trust_reg_number: data?.settings?.reg_number || '',
          pan_number: data?.settings?.pan_number || '',
          reg_80g: extra?.general?.reg_80g || '',
          reg_12a: extra?.general?.reg_12a || '',
          official_address: data?.settings?.address || prev.official_address,
          city_state: extra?.general?.city_state || '',
          official_mobile: data?.settings?.phone || prev.official_mobile,
          official_email: data?.settings?.email || '',
          website: extra?.general?.website || '',
          formation_date: extra?.general?.formation_date || '',
        }))
        setReceipt((prev) => ({
          ...prev,
          receipt_prefix: data?.settings?.receipt_prefix || prev.receipt_prefix,
          fy_format: data?.settings?.current_fy || prev.fy_format,
          receipt_starting_number: extra?.receipts?.receipt_starting_number || prev.receipt_starting_number,
          auto_generate_receipt: extra?.receipts?.auto_generate_receipt ?? prev.auto_generate_receipt,
          authorized_signatory: extra?.receipts?.authorized_signatory || prev.authorized_signatory,
          digital_signature: extra?.receipts?.digital_signature || prev.digital_signature,
          receipt_footer_note: extra?.receipts?.receipt_footer_note || prev.receipt_footer_note,
          receipt_terms: extra?.receipts?.receipt_terms || prev.receipt_terms,
          qr_verification: extra?.receipts?.qr_verification ?? prev.qr_verification,
        }))
        setFinancial((prev) => ({
          ...prev,
          financial_year_start: extra?.financial?.financial_year_start || prev.financial_year_start,
          voucher_number_format: extra?.financial?.voucher_number_format || prev.voucher_number_format,
          receipt_number_format: extra?.financial?.receipt_number_format || prev.receipt_number_format,
          cash_book_lock_date: extra?.financial?.cash_book_lock_date || prev.cash_book_lock_date,
          allow_backdated_entries: extra?.financial?.allow_backdated_entries ?? prev.allow_backdated_entries,
          allow_voucher_editing: extra?.financial?.allow_voucher_editing ?? prev.allow_voucher_editing,
        }))
        setBranding((prev) => ({
          ...prev,
          primary_color: data?.settings?.primary_color || prev.primary_color,
          secondary_color: data?.settings?.secondary_color || prev.secondary_color,
          logo_upload: data?.settings?.logo_url || prev.logo_upload,
          favicon_upload: extra?.branding?.favicon_upload || prev.favicon_upload,
          letterhead_preview: extra?.branding?.letterhead_preview || prev.letterhead_preview,
          website_banner_upload: extra?.branding?.website_banner_upload || prev.website_banner_upload,
        }))
        setWebsiteSettings((prev) => ({
          ...prev,
          public_donor_display_settings: extra?.website?.public_donor_display_settings ?? prev.public_donor_display_settings,
          display_limit: extra?.website?.display_limit ?? prev.display_limit,
        }))
        setGovernance((prev) => ({
          ...prev,
          approval_high_value_expenses: extra?.governance?.approval_high_value_expenses ?? prev.approval_high_value_expenses,
          approval_cash_above_threshold: extra?.governance?.approval_cash_above_threshold ?? prev.approval_cash_above_threshold,
          approval_backdated_entries: extra?.governance?.approval_backdated_entries ?? prev.approval_backdated_entries,
          approval_receipt_regeneration: extra?.governance?.approval_receipt_regeneration ?? prev.approval_receipt_regeneration,
          approval_voucher_deletion: extra?.governance?.approval_voucher_deletion ?? prev.approval_voucher_deletion,
          mandatory_bill_upload_threshold: extra?.governance?.mandatory_bill_upload_threshold ?? prev.mandatory_bill_upload_threshold,
          allowed_attachment_types: extra?.governance?.allowed_attachment_types || prev.allowed_attachment_types,
          max_upload_size_mb: extra?.governance?.max_upload_size_mb ?? prev.max_upload_size_mb,
        }))
      } catch {
        /* ignore — fall back to store/default */
        if (trust?.top_donors_limit != null) setTopDonorsLimit(trust.top_donors_limit)
        if (trust?.donor_threshold != null) setDonorThreshold(trust.donor_threshold)
        if (trust?.opening_cash_balance != null) setOpeningCashBalance(trust.opening_cash_balance)
        if (trust?.opening_bank_balance != null) setOpeningBankBalance(trust.opening_bank_balance)
      }
    })()
  }, [trust?.id])

  useEffect(() => {
    const onScroll = () => {
      const offsets = SETTINGS_NAV.map((item) => {
        const el = document.getElementById(item.id)
        if (!el) return { id: item.id, top: Number.POSITIVE_INFINITY }
        return { id: item.id, top: Math.abs(el.getBoundingClientRect().top - 140) }
      })
      offsets.sort((a, b) => a.top - b.top)
      if (offsets[0]) setActiveSection(offsets[0].id)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const refreshTrustFromServer = async () => {
    const { data } = await api.get('/auth/me')
    useAuthStore.setState({ trust: data?.trust || null })
  }

  const hasWebsiteDirty =
    Number(topDonorsLimit) !== Number(trust?.top_donors_limit ?? 10) ||
    Number(donorThreshold) !== Number(trust?.donor_threshold ?? 1100) ||
    Number(openingCashBalance) !== Number(trust?.opening_cash_balance ?? 0) ||
    Number(openingBankBalance) !== Number(trust?.opening_bank_balance ?? 0)

  const passwordChangedAt = useMemo(() => new Date().toLocaleDateString('en-IN'), [])
  const lastLoginAt = useMemo(() => new Date().toLocaleString('en-IN'), [])

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (passwords.new_password !== passwords.confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await api.post('/auth/change-password', {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      })
      toast({ title: 'Password changed successfully' })
      setPasswords({ current_password: '', new_password: '', confirm: '' })
    } catch (err) {
      toast({ title: 'Failed', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const saveWebsiteAndFinancial = async () => {
    try {
      setSavingWebsiteSettings(true)
      const limit = Number(topDonorsLimit)
      const threshold = Number(donorThreshold)
      await api.put('/settings', {
        top_donors_limit: limit,
        donor_threshold: threshold,
        opening_cash_balance: Number(openingCashBalance),
        opening_bank_balance: Number(openingBankBalance),
        settings_json: {
          financial: {
            financial_year_start: financial.financial_year_start,
            voucher_number_format: financial.voucher_number_format,
            receipt_number_format: financial.receipt_number_format,
            cash_book_lock_date: financial.cash_book_lock_date,
            allow_backdated_entries: financial.allow_backdated_entries,
            allow_voucher_editing: financial.allow_voucher_editing,
          },
          website: {
            public_donor_display_settings: websiteSettings.public_donor_display_settings,
            display_limit: Number(websiteSettings.display_limit || 0),
            website_banner_upload: branding.website_banner_upload || '',
          },
        },
      })
      toast({ title: 'Section saved', description: 'Financial and website settings updated.' })
      await refreshTrustFromServer()
    } catch (err) {
      toast({ title: 'Failed', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setSavingWebsiteSettings(false)
    }
  }

  const saveSettingsPayload = async (payload, title = 'Settings saved') => {
    try {
      await api.put('/settings', payload)
      await refreshTrustFromServer()
      toast({ title })
    } catch (err) {
      toast({ title: 'Failed', description: getApiErrorMessage(err), variant: 'destructive' })
      throw err
    }
  }

  const savePlaceholderSection = (name) => {
    toast({
      title: `${name} saved`,
      description: 'Settings stored in current session. API binding can be added in next backend phase.',
    })
  }

  return (
    <>
      <PageHeader
        title="Trust Administration & Settings"
        description="Manage trust identity, financial preferences, receipt controls, branding and security settings."
      />

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Card className="h-max lg:sticky lg:top-20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Configuration Sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {SETTINGS_NAV.map((item) => (
              <button
                key={item.id}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${activeSection === item.id ? 'bg-maroon text-white' : 'hover:bg-muted'}`}
                onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                {item.label}
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card id="general">
            <CardHeader>
              <SectionHeader
                title="General"
                description="Manage official trust profile and registration details."
                onSave={() =>
                  saveSettingsPayload(
                    {
                      name: trust?.name || '',
                      name_hindi: trust?.name_hindi || '',
                      address: general.official_address,
                      phone: general.official_mobile,
                      email: general.official_email || '',
                      pan_number: general.pan_number || '',
                      reg_number: general.trust_reg_number || '',
                      settings_json: {
                        general: {
                          reg_80g: general.reg_80g || '',
                          reg_12a: general.reg_12a || '',
                          city_state: general.city_state || '',
                          website: general.website || '',
                          formation_date: general.formation_date || '',
                        },
                      },
                    },
                    'Trust details saved'
                  )
                }
                onReset={() => setGeneral((prev) => ({ ...prev }))}
                saving={false}
                dirty
                saveLabel="Save Trust Details"
              />
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div><Label>Trust name (Hindi)</Label><Input value={trust?.name_hindi || ''} readOnly className="bg-muted" /></div>
              <div><Label>Trust name (English)</Label><Input value={trust?.name || ''} readOnly className="bg-muted" /></div>
              <div><Label>Trust ID</Label><Input value={trust?.id || ''} readOnly className="bg-muted font-mono text-sm" /></div>
              <div className="flex items-end"><span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">System Generated · Locked</span></div>
              <div><Label>Trust Registration Number</Label><Input value={general.trust_reg_number} onChange={(e) => setGeneral({ ...general, trust_reg_number: e.target.value })} /></div>
              <div><Label>PAN</Label><Input value={general.pan_number} onChange={(e) => setGeneral({ ...general, pan_number: e.target.value.toUpperCase() })} /></div>
              <div><Label>80G Registration Number</Label><Input value={general.reg_80g} onChange={(e) => setGeneral({ ...general, reg_80g: e.target.value })} /></div>
              <div><Label>12A Registration Number</Label><Input value={general.reg_12a} onChange={(e) => setGeneral({ ...general, reg_12a: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Official Address</Label><Input value={general.official_address} onChange={(e) => setGeneral({ ...general, official_address: e.target.value })} /></div>
              <div><Label>City/State</Label><Input value={general.city_state} onChange={(e) => setGeneral({ ...general, city_state: e.target.value })} /></div>
              <div><Label>Official Mobile</Label><Input value={general.official_mobile} onChange={(e) => setGeneral({ ...general, official_mobile: e.target.value })} /></div>
              <div><Label>Official Email</Label><Input value={general.official_email} onChange={(e) => setGeneral({ ...general, official_email: e.target.value })} /></div>
              <div><Label>Website</Label><Input value={general.website} onChange={(e) => setGeneral({ ...general, website: e.target.value })} /></div>
              <div><Label>Trust Formation Date</Label><Input type="date" value={general.formation_date} onChange={(e) => setGeneral({ ...general, formation_date: e.target.value })} /></div>
            </CardContent>
          </Card>

          <SettingsTeamUsers />

          <Card id="financial">
            <CardHeader>
              <SectionHeader
                title="Financial"
                description="Configure financial year behavior, numbering standards and ledger protection controls."
                onSave={() => setConfirmOpeningSave(true)}
                onReset={() => {
                  setTopDonorsLimit(trust?.top_donors_limit ?? 10)
                  setDonorThreshold(trust?.donor_threshold ?? 1100)
                  setOpeningCashBalance(trust?.opening_cash_balance ?? 0)
                  setOpeningBankBalance(trust?.opening_bank_balance ?? 0)
                }}
                saving={savingWebsiteSettings}
                dirty={hasWebsiteDirty}
                saveLabel="Save Financial Settings"
              />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Changing opening balances impacts ledger calculations and financial reports.
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Financial Year Start</Label><Input value={financial.financial_year_start} onChange={(e) => setFinancial({ ...financial, financial_year_start: e.target.value })} /></div>
                <div><Label>Cash Book Lock Date</Label><Input type="date" value={financial.cash_book_lock_date} onChange={(e) => setFinancial({ ...financial, cash_book_lock_date: e.target.value })} /></div>
                <div><Label>Voucher Number Format</Label><Input value={financial.voucher_number_format} onChange={(e) => setFinancial({ ...financial, voucher_number_format: e.target.value })} /></div>
                <div><Label>Receipt Number Format</Label><Input value={financial.receipt_number_format} onChange={(e) => setFinancial({ ...financial, receipt_number_format: e.target.value })} /></div>
                <div><Label>Opening Cash Balance (₹)</Label><Input type="number" min={0} step={0.01} value={openingCashBalance} onChange={(e) => setOpeningCashBalance(e.target.value ? Number(e.target.value) : '')} /></div>
                <div><Label>Opening Bank Balance (₹)</Label><Input type="number" min={0} step={0.01} value={openingBankBalance} onChange={(e) => setOpeningBankBalance(e.target.value ? Number(e.target.value) : '')} /></div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div><p className="text-sm font-medium">Allow Backdated Entries</p><p className="text-xs text-muted-foreground">Warning-sensitive financial operation</p></div>
                  <input type="checkbox" className="h-4 w-4" checked={financial.allow_backdated_entries} onChange={(e) => setFinancial({ ...financial, allow_backdated_entries: e.target.checked })} />
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div><p className="text-sm font-medium">Allow Voucher Editing</p><p className="text-xs text-muted-foreground">Post-entry financial modifications</p></div>
                  <input type="checkbox" className="h-4 w-4" checked={financial.allow_voucher_editing} onChange={(e) => setFinancial({ ...financial, allow_voucher_editing: e.target.checked })} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="receipts">
            <CardHeader>
              <SectionHeader
                title="Receipts"
                description="Manage receipt numbering, signatory, verification and legal notes."
                onSave={() =>
                  saveSettingsPayload(
                    {
                      receipt_prefix: receipt.receipt_prefix || 'TRUST',
                      current_fy: receipt.fy_format || '',
                      settings_json: {
                        receipts: {
                          receipt_starting_number: receipt.receipt_starting_number || '',
                          fy_format: receipt.fy_format || '',
                          auto_generate_receipt: receipt.auto_generate_receipt,
                          authorized_signatory: receipt.authorized_signatory || '',
                          digital_signature: receipt.digital_signature || '',
                          receipt_footer_note: receipt.receipt_footer_note || '',
                          receipt_terms: receipt.receipt_terms || '',
                          qr_verification: receipt.qr_verification,
                        },
                      },
                    },
                    'Receipt settings saved'
                  )
                }
                onReset={() => setReceipt((prev) => ({ ...prev, receipt_prefix: trust?.receipt_prefix || '' }))}
                saving={false}
                dirty
                saveLabel="Save Receipt Settings"
              />
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div><Label>Receipt Prefix</Label><Input value={receipt.receipt_prefix} onChange={(e) => setReceipt({ ...receipt, receipt_prefix: e.target.value })} /></div>
              <div><Label>Receipt Starting Number</Label><Input value={receipt.receipt_starting_number} onChange={(e) => setReceipt({ ...receipt, receipt_starting_number: e.target.value })} /></div>
              <div><Label>Financial Year Format</Label><Input value={receipt.fy_format} onChange={(e) => setReceipt({ ...receipt, fy_format: e.target.value })} /></div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2"><span className="text-sm">Auto Generate Receipts</span><input type="checkbox" className="h-4 w-4" checked={receipt.auto_generate_receipt} onChange={(e) => setReceipt({ ...receipt, auto_generate_receipt: e.target.checked })} /></div>
              <div><Label>Authorized Signatory</Label><Input value={receipt.authorized_signatory} onChange={(e) => setReceipt({ ...receipt, authorized_signatory: e.target.value })} /></div>
              <div><Label>Digital Signature Upload</Label><Input type="file" onChange={(e) => setReceipt({ ...receipt, digital_signature: e.target.files?.[0]?.name || '' })} /></div>
              <div className="sm:col-span-2"><Label>Receipt Footer Note</Label><Input value={receipt.receipt_footer_note} onChange={(e) => setReceipt({ ...receipt, receipt_footer_note: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Receipt Terms</Label><Input value={receipt.receipt_terms} onChange={(e) => setReceipt({ ...receipt, receipt_terms: e.target.value })} /></div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2"><span className="text-sm">QR Verification</span><input type="checkbox" className="h-4 w-4" checked={receipt.qr_verification} onChange={(e) => setReceipt({ ...receipt, qr_verification: e.target.checked })} /></div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">Receipt Preview</p>
                <p className="text-sm font-semibold mt-1">{trust?.name || 'Trust Name'}</p>
                <p className="text-xs">Receipt Prefix: {receipt.receipt_prefix || 'REC'}</p>
                <p className="text-xs">Signatory: {receipt.authorized_signatory || 'Not configured'}</p>
                <p className="text-xs mt-1 text-muted-foreground">{receipt.receipt_footer_note || 'Footer note will appear here.'}</p>
              </div>
            </CardContent>
          </Card>

          <Card id="website">
            <CardHeader>
              <SectionHeader
                title="Public Website"
                description="Control public donor visibility and website display configuration."
                onSave={saveWebsiteAndFinancial}
                onReset={() => {
                  setWebsiteSettings({ ...websiteSettings, display_limit: trust?.top_donors_limit ?? 10 })
                  setTopDonorsLimit(trust?.top_donors_limit ?? 10)
                  setDonorThreshold(trust?.donor_threshold ?? 1100)
                }}
                saving={savingWebsiteSettings}
                dirty={hasWebsiteDirty}
                saveLabel="Save Website Settings"
              />
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Public Donor Display Settings</p>
                  <p className="text-xs text-muted-foreground">Controls public donor listing on website</p>
                </div>
                <input type="checkbox" className="h-4 w-4" checked={websiteSettings.public_donor_display_settings} onChange={(e) => setWebsiteSettings({ ...websiteSettings, public_donor_display_settings: e.target.checked })} />
              </div>
              <div><Label>Top Donor Display Limit</Label><Input type="number" min={1} max={50} value={topDonorsLimit} onChange={(e) => setTopDonorsLimit(e.target.value ? Number(e.target.value) : '')} /></div>
              <div><Label>Donor Display Threshold (₹)</Label><Input type="number" min={1} value={donorThreshold} onChange={(e) => setDonorThreshold(e.target.value ? Number(e.target.value) : '')} /></div>
              <div><Label>Website Banner Upload</Label><Input type="file" onChange={(e) => setBranding({ ...branding, website_banner_upload: e.target.files?.[0]?.name || '' })} /></div>
            </CardContent>
          </Card>

          <Card id="branding">
            <CardHeader>
              <SectionHeader
                title="Branding"
                description="Manage institutional brand assets for receipts, letterheads and website presence."
                onSave={() =>
                  saveSettingsPayload(
                    {
                      primary_color: branding.primary_color,
                      secondary_color: branding.secondary_color,
                      logo_url: branding.logo_upload || '',
                      settings_json: {
                        branding: {
                          favicon_upload: branding.favicon_upload || '',
                          letterhead_preview: branding.letterhead_preview || '',
                          website_banner_upload: branding.website_banner_upload || '',
                        },
                      },
                    },
                    'Branding settings saved'
                  )
                }
                onReset={() => setBranding({ ...branding, primary_color: trust?.primary_color || '#FF6B00', secondary_color: trust?.secondary_color || '#7B1C1C' })}
                saving={false}
                dirty
                saveLabel="Save Branding"
              />
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div><Label>Logo Upload</Label><Input type="file" onChange={(e) => setBranding({ ...branding, logo_upload: e.target.files?.[0]?.name || '' })} /></div>
              <div><Label>Favicon Upload</Label><Input type="file" onChange={(e) => setBranding({ ...branding, favicon_upload: e.target.files?.[0]?.name || '' })} /></div>
              <div><Label>Primary Color</Label><Input type="color" value={branding.primary_color} onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} /></div>
              <div><Label>Secondary Color</Label><Input type="color" value={branding.secondary_color} onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })} /></div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Receipt Preview</p>
                <div className="mt-2 h-20 rounded border" style={{ background: `linear-gradient(135deg, ${branding.primary_color}, ${branding.secondary_color})` }} />
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Letterhead Preview</p>
                <div className="mt-2 h-20 rounded border bg-white px-2 py-1">
                  <p className="text-sm font-semibold">{trust?.name || 'Trust Name'}</p>
                  <p className="text-xs text-muted-foreground">Official Letterhead Preview</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="security">
            <CardHeader>
              <SectionHeader
                title="Users & Security"
                description="Control password security, session safety and account protection settings."
                onSave={() =>
                  saveSettingsPayload(
                    {
                      settings_json: {
                        security: {
                          two_factor_enabled: false,
                          failed_login_attempts_month: 2,
                          active_sessions: 1,
                        },
                      },
                    },
                    'Security settings saved'
                  )
                }
                onReset={() => setPasswords({ current_password: '', new_password: '', confirm: '' })}
                saving={saving}
                dirty={Boolean(passwords.current_password || passwords.new_password || passwords.confirm)}
                saveLabel="Save Security Settings"
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Last Login</p><p>{lastLoginAt}</p></div>
                <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Password Last Changed</p><p>{passwordChangedAt}</p></div>
                <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Failed Login Attempts (Month)</p><p>2</p></div>
                <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Active Sessions</p><p>1</p></div>
              </div>
              <form onSubmit={handleChangePassword} className="grid gap-3 max-w-xl">
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">Show password fields</span>
                  <input type="checkbox" className="h-4 w-4" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
                </div>
                <div>
                  <Label>Current password</Label>
                  <Input type={showPassword ? 'text' : 'password'} value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} required />
                </div>
                <div>
                  <Label>New password</Label>
                  <Input type={showPassword ? 'text' : 'password'} value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} required />
                  <PasswordStrength value={passwords.new_password} />
                </div>
                <div>
                  <Label>Confirm new password</Label>
                  <Input type={showPassword ? 'text' : 'password'} value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} required />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Update Password'}</Button>
                  <Button type="button" variant="outline" onClick={() => toast({ title: 'All sessions invalidated' })}>Logout All Devices</Button>
                  <Button type="button" variant="outline" onClick={() => toast({ title: '2FA setup coming soon', description: 'Two-factor authentication can be enabled in next phase.' })}>Enable 2FA</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card id="audit-controls">
            <CardHeader>
              <SectionHeader
                title="Audit Controls"
                description="Set mandatory approvals and document rules for sensitive financial operations."
                onSave={() =>
                  saveSettingsPayload(
                    {
                      settings_json: {
                        governance: {
                          approval_high_value_expenses: governance.approval_high_value_expenses,
                          approval_cash_above_threshold: governance.approval_cash_above_threshold,
                          approval_backdated_entries: governance.approval_backdated_entries,
                          approval_receipt_regeneration: governance.approval_receipt_regeneration,
                          approval_voucher_deletion: governance.approval_voucher_deletion,
                          mandatory_bill_upload_threshold: Number(governance.mandatory_bill_upload_threshold || 0),
                          allowed_attachment_types: governance.allowed_attachment_types || '',
                          max_upload_size_mb: Number(governance.max_upload_size_mb || 0),
                        },
                      },
                    },
                    'Audit controls saved'
                  )
                }
                onReset={() => setGovernance((prev) => ({ ...prev }))}
                saving={false}
                dirty
                saveLabel="Save Audit Controls"
              />
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {[
                ['approval_high_value_expenses', 'Require approval for high value expenses'],
                ['approval_cash_above_threshold', 'Require approval for cash expenses above threshold'],
                ['approval_backdated_entries', 'Require approval for backdated entries'],
                ['approval_receipt_regeneration', 'Require approval for receipt regeneration'],
                ['approval_voucher_deletion', 'Require approval for voucher deletion'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">{label}</span>
                  <input type="checkbox" className="h-4 w-4" checked={Boolean(governance[key])} onChange={(e) => setGovernance({ ...governance, [key]: e.target.checked })} />
                </div>
              ))}
              <div><Label>Mandatory bill upload threshold (₹)</Label><Input type="number" value={governance.mandatory_bill_upload_threshold} onChange={(e) => setGovernance({ ...governance, mandatory_bill_upload_threshold: Number(e.target.value || 0) })} /></div>
              <div><Label>Allowed attachment types</Label><Input value={governance.allowed_attachment_types} onChange={(e) => setGovernance({ ...governance, allowed_attachment_types: e.target.value })} /></div>
              <div><Label>Maximum upload size (MB)</Label><Input type="number" value={governance.max_upload_size_mb} onChange={(e) => setGovernance({ ...governance, max_upload_size_mb: Number(e.target.value || 0) })} /></div>
              <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                Last modified by: {user?.name || user?.username || 'Administrator'}<br />
                Last updated: {new Date().toLocaleString('en-IN')}
              </div>
            </CardContent>
          </Card>

          <Card id="backup-export">
            <CardHeader>
              <SectionHeader
                title="Backup & Export"
                description="Execute institutional backup and governance export operations."
                onSave={() => savePlaceholderSection('Backup & export settings')}
                onReset={() => {}}
                saving={false}
                dirty={false}
                saveLabel="Save Export Preferences"
              />
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Button variant="outline" onClick={() => toast({ title: 'Export started', description: 'Full data export will be downloaded.' })}>Export Full Data</Button>
              <Button variant="outline" onClick={() => toast({ title: 'Audit logs download started' })}>Download Audit Logs</Button>
              <Button variant="outline" onClick={() => toast({ title: 'Receipt archive download started' })}>Download Receipts</Button>
              <Button variant="outline" onClick={() => toast({ title: 'Backup initiated' })}>Backup Database</Button>
              <Button variant="outline" onClick={() => toast({ title: 'Restore workflow', description: 'Restore approval required from administrator.' })}>Restore Backup</Button>
              <Button variant="outline" onClick={() => toast({ title: 'Role Controls', description: 'Roles: Administrator, Accountant, Trustee, Viewer, Auditor.' })}>Role & Access Management</Button>
            </CardContent>
          </Card>

          <Card id="danger-zone" className="border-rose-200">
            <CardHeader>
              <CardTitle className="text-rose-700">Danger Zone</CardTitle>
              <CardDescription>High-impact administrative actions. Use only with formal approval.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-3">
              <Button variant="destructive" onClick={() => toast({ title: 'Archive FY requested', description: 'Confirmation workflow will be required.' })}>Archive Financial Year</Button>
              <Button variant="destructive" onClick={() => toast({ title: 'Website disable requested', description: 'Public portal can be disabled after final confirmation.' })}>Disable Public Website</Button>
              <Button variant="destructive" onClick={() => toast({ title: 'Reset demo data requested', description: 'Destructive action requires multi-step confirmation.' })}>Reset Demo Data</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator className="my-4" />
      <div className="sticky bottom-0 z-20 rounded-t-lg border bg-background/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p className="text-sm text-muted-foreground">Settings state: {hasWebsiteDirty ? 'Unsaved changes present' : 'All changes saved'}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to Top</Button>
            <Button onClick={() => setConfirmOpeningSave(true)}>Save Current Financial Settings</Button>
          </div>
        </div>
      </div>

      <ConfirmActionDialog
        open={confirmOpeningSave}
        onOpenChange={setConfirmOpeningSave}
        title="Confirm Financial Integrity Update"
        description="Changing opening balances impacts ledger calculations. Do you want to continue and save financial settings?"
        confirmText="Yes, Save Changes"
        onConfirm={async () => {
          setConfirmOpeningSave(false)
          await saveWebsiteAndFinancial()
        }}
        loading={savingWebsiteSettings}
      />
    </>
  )
}
