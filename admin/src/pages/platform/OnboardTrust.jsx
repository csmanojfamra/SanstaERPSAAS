import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import PageHeader from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import api, { getApiErrorMessage } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

function suggestSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
}

const defaultForm = {
  slug: '',
  name: '',
  name_hindi: '',
  address: '',
  phone: '',
  email: '',
  receipt_prefix: '',
  current_fy: '2025-26',
  primary_color: '#FF6B00',
  secondary_color: '#7B1C1C',
  admin_name: '',
  admin_username: '',
  admin_password: '',
  admin_password_confirm: '',
}

export default function OnboardTrust() {
  const navigate = useNavigate()
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.admin_password !== form.admin_password_confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const payload = {
        slug: form.slug.trim().toLowerCase(),
        name: form.name.trim(),
        name_hindi: form.name_hindi.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        receipt_prefix: form.receipt_prefix.trim().toUpperCase(),
        current_fy: form.current_fy.trim(),
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        admin_name: form.admin_name.trim(),
        admin_username: form.admin_username.trim().toLowerCase(),
        admin_password: form.admin_password,
      }
      const { data } = await api.post('/platform/trusts', payload)
      toast({
        title: 'Trust onboarded',
        description: `${data.trust.name} — admin login: ${data.admin_user.username}`,
      })
      navigate(`/platform/trusts/${data.trust.id}/users`)
    } catch (err) {
      toast({ title: 'Onboarding failed', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Onboard new trust"
        description="Create a new temple trust / NGO tenant and its first administrator login."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trust details</CardTitle>
            <CardDescription>Basic profile used in receipts and admin branding.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Trust name (English)</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value
                  setForm((f) => ({
                    ...f,
                    name,
                    slug: f.slug || suggestSlug(name),
                  }))
                }}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="slug">Subdomain slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="temple-name-city"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Login URL: {form.slug || 'slug'}.yourdomain.com/admin/login (configure TENANT_BASE_DOMAIN on server)
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="name_hindi">Trust name (Hindi)</Label>
              <Input id="name_hindi" value={form.name_hindi} onChange={(e) => set('name_hindi', e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={form.address} onChange={(e) => set('address', e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="phone">Phone (10 digits)</Label>
              <Input id="phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={10} required />
            </div>
            <div>
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="receipt_prefix">Receipt prefix</Label>
              <Input
                id="receipt_prefix"
                value={form.receipt_prefix}
                onChange={(e) => set('receipt_prefix', e.target.value.toUpperCase())}
                placeholder="SSSM"
                maxLength={10}
                required
              />
            </div>
            <div>
              <Label htmlFor="current_fy">Financial year</Label>
              <Input id="current_fy" value={form.current_fy} onChange={(e) => set('current_fy', e.target.value)} placeholder="2025-26" required />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">First admin user</CardTitle>
            <CardDescription>This person can log in to the trust ERP and add more users later.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="admin_name">Full name</Label>
              <Input id="admin_name" value={form.admin_name} onChange={(e) => set('admin_name', e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="admin_username">Username</Label>
              <Input
                id="admin_username"
                value={form.admin_username}
                onChange={(e) => set('admin_username', e.target.value.toLowerCase())}
                placeholder="admin"
                required
              />
            </div>
            <div />
            <div>
              <Label htmlFor="admin_password">Password</Label>
              <Input
                id="admin_password"
                type="password"
                value={form.admin_password}
                onChange={(e) => set('admin_password', e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">Min 8 chars, 1 uppercase, 1 number</p>
            </div>
            <div>
              <Label htmlFor="admin_password_confirm">Confirm password</Label>
              <Input
                id="admin_password_confirm"
                type="password"
                value={form.admin_password_confirm}
                onChange={(e) => set('admin_password_confirm', e.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create trust & admin'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/platform">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
