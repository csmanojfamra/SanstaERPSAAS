import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Users, Building2, MessageCircle } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import HeaderIconButton from '@/components/layout/HeaderIconButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import FormDialogFooter from '@/components/common/FormDialogFooter'
import api, { getApiErrorMessage } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

const EMPTY_WHATSAPP = {
  base_url: 'https://wa.fastlegal.in',
  account_name: 'fastlegal',
  template_name: 'donation_receipt',
  api_key: '',
  has_api_key: false,
  api_key_hint: '',
  api_key_source: 'missing',
}

export default function PlatformTrusts() {
  const [trusts, setTrusts] = useState([])
  const [loading, setLoading] = useState(true)
  const [whatsapp, setWhatsapp] = useState(EMPTY_WHATSAPP)
  const [savingWhatsapp, setSavingWhatsapp] = useState(false)
  const [numberTrust, setNumberTrust] = useState(null)
  const [numberForm, setNumberForm] = useState({
    whatsapp_enabled: true,
    whatsapp_account: '',
    whatsapp_template: '',
  })
  const [savingNumber, setSavingNumber] = useState(false)

  const loadTrusts = async () => {
    setLoading(true)
    try {
      const [trustRes, whatsappRes] = await Promise.all([
        api.get('/platform/trusts'),
        api.get('/platform/whatsapp'),
      ])
      setTrusts(trustRes.data.trusts || [])
      setWhatsapp({ ...EMPTY_WHATSAPP, ...(whatsappRes.data.whatsapp || {}), api_key: '' })
    } catch (err) {
      toast({ title: 'Failed to load trusts', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrusts()
  }, [])

  const saveWhatsapp = async (event) => {
    event.preventDefault()
    setSavingWhatsapp(true)
    try {
      const { data } = await api.put('/platform/whatsapp', {
        base_url: whatsapp.base_url.trim(),
        account_name: whatsapp.account_name.trim(),
        template_name: whatsapp.template_name.trim(),
        api_key: whatsapp.api_key.trim(),
      })
      setWhatsapp({ ...EMPTY_WHATSAPP, ...(data.whatsapp || {}), api_key: '' })
      toast({ title: 'WhatsApp connection saved' })
    } catch (err) {
      toast({ title: 'Could not save WhatsApp', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setSavingWhatsapp(false)
    }
  }

  const openNumber = (trust) => {
    setNumberTrust(trust)
    setNumberForm({
      whatsapp_enabled: trust.whatsapp_enabled !== false,
      whatsapp_account: trust.whatsapp_account || '',
      whatsapp_template: trust.whatsapp_template || '',
    })
  }

  const saveNumber = async (event) => {
    event.preventDefault()
    if (!numberTrust) return
    setSavingNumber(true)
    try {
      const { data } = await api.put(`/platform/trusts/${numberTrust.id}/whatsapp`, numberForm)
      setTrusts((prev) =>
        prev.map((item) =>
          item.id === data.trust.id ? { ...item, ...data.trust, user_count: item.user_count } : item
        )
      )
      setNumberTrust(null)
      toast({ title: 'Trust WhatsApp number saved' })
    } catch (err) {
      toast({ title: 'Could not save number', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setSavingNumber(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trusts & Temples"
        mobileTitle="Trusts"
        description="All clients onboarded on the platform. Manage users for each trust."
        mobileAction={<HeaderIconButton icon={Plus} label="Onboard new trust" to="/platform/onboard" />}
      >
        <Button asChild>
          <Link to="/platform/onboard">
            <Plus className="mr-2 h-4 w-4" />
            Onboard new trust
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total trusts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? '—' : trusts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-700">
              {loading ? '—' : trusts.filter((t) => t.is_active).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {loading ? '—' : trusts.reduce((sum, t) => sum + (t.user_count || 0), 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-5 w-5" />
            WhatsApp connection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveWhatsapp}>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wa-base">Whatomate URL</Label>
              <Input
                id="wa-base"
                value={whatsapp.base_url}
                onChange={(e) => setWhatsapp((prev) => ({ ...prev, base_url: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-key">API key</Label>
              <Input
                id="wa-key"
                type="password"
                autoComplete="new-password"
                value={whatsapp.api_key}
                placeholder={whatsapp.has_api_key ? `Saved (${whatsapp.api_key_hint})` : 'Paste the Whatomate API key'}
                onChange={(e) => setWhatsapp((prev) => ({ ...prev, api_key: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                {whatsapp.api_key_source === 'panel'
                  ? 'This key is stored in the panel. Leave blank to keep it.'
                  : whatsapp.api_key_source === 'env'
                    ? 'Using the server environment key until you save one here.'
                    : 'No key saved yet.'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-account">Default WhatsApp account</Label>
              <Input
                id="wa-account"
                value={whatsapp.account_name}
                onChange={(e) => setWhatsapp((prev) => ({ ...prev, account_name: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">Demo number account, used when a trust has no own number.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-template">Default template</Label>
              <Input
                id="wa-template"
                value={whatsapp.template_name}
                onChange={(e) => setWhatsapp((prev) => ({ ...prev, template_name: e.target.value }))}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={savingWhatsapp}>
                {savingWhatsapp ? 'Saving…' : 'Save WhatsApp connection'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5" />
            Onboarded trusts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : trusts.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No trusts yet.{' '}
              <Link to="/platform/onboard" className="font-medium text-primary underline">
                Onboard your first trust
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trust</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Receipt prefix</TableHead>
                  <TableHead>FY</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trusts.map((trust) => (
                  <TableRow key={trust.id}>
                    <TableCell>
                      <p className="font-medium">{trust.name}</p>
                      <p className="text-xs text-muted-foreground">{trust.name_hindi}</p>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{trust.slug || '—'}</code>
                    </TableCell>
                    <TableCell>{trust.phone}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{trust.receipt_prefix}</code>
                    </TableCell>
                    <TableCell>{trust.current_fy}</TableCell>
                    <TableCell>{trust.user_count ?? 0}</TableCell>
                    <TableCell>
                      {trust.whatsapp_enabled === false ? (
                        <Badge variant="secondary">Off</Badge>
                      ) : (
                        <span className="text-xs">{trust.whatsapp_account || 'Platform default'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={trust.is_active ? 'default' : 'secondary'}>
                        {trust.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openNumber(trust)}>
                          Number
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/platform/trusts/${trust.id}/users`}>
                            <Users className="mr-1.5 h-3.5 w-3.5" />
                            Users
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(numberTrust)} onOpenChange={(open) => !open && setNumberTrust(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>WhatsApp number</DialogTitle>
            <DialogDescription>
              {numberTrust?.name}. Leave the account blank to use the platform default ({whatsapp.account_name || 'fastlegal'}).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveNumber}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={numberForm.whatsapp_enabled}
                onChange={(e) => setNumberForm((prev) => ({ ...prev, whatsapp_enabled: e.target.checked }))}
              />
              Send receipts on WhatsApp
            </label>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="trust-wa-account">Whatomate account name</Label>
              <Input
                id="trust-wa-account"
                value={numberForm.whatsapp_account}
                placeholder={whatsapp.account_name || 'fastlegal'}
                onChange={(e) => setNumberForm((prev) => ({ ...prev, whatsapp_account: e.target.value }))}
              />
            </div>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="trust-wa-template">Template name</Label>
              <Input
                id="trust-wa-template"
                value={numberForm.whatsapp_template}
                placeholder={whatsapp.template_name || 'donation_receipt'}
                onChange={(e) => setNumberForm((prev) => ({ ...prev, whatsapp_template: e.target.value }))}
              />
            </div>
            <FormDialogFooter>
              <Button type="button" variant="outline" onClick={() => setNumberTrust(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingNumber}>
                {savingNumber ? 'Saving…' : 'Save'}
              </Button>
            </FormDialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {!loading && trusts.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Created dates shown in trust detail. Oldest trusts appear last in the list.
        </p>
      ) : null}
    </div>
  )
}
