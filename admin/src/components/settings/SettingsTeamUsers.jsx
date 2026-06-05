import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import api, { getApiErrorMessage } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { formatDate } from '@/utils/formatters'
import { buildLocalTenantLoginUrl } from '@/lib/tenant'

export default function SettingsTeamUsers() {
  const [users, setUsers] = useState([])
  const [slug, setSlug] = useState('')
  const [customDomain, setCustomDomain] = useState('')
  const [loginUrl, setLoginUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [resetUser, setResetUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'OPERATOR' })

  const load = async () => {
    setLoading(true)
    try {
      const [usersRes, settingsRes] = await Promise.all([api.get('/users'), api.get('/settings')])
      const data = usersRes.data
      setUsers(data.users || [])
      setSlug(data.slug || settingsRes.data.settings?.slug || '')
      setCustomDomain(settingsRes.data.settings?.custom_domain || '')
      setLoginUrl(data.login_url || buildLocalTenantLoginUrl(data.slug || settingsRes.data.settings?.slug))
    } catch (err) {
      toast({ title: 'Failed to load team', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const saveTenantAccess = async () => {
    setSaving(true)
    try {
      const { data } = await api.put('/settings/tenant-access', {
        slug: slug.trim().toLowerCase(),
        custom_domain: customDomain.trim(),
      })
      setLoginUrl(data.login_url || buildLocalTenantLoginUrl(data.slug))
      toast({ title: 'Login URL updated' })
    } catch (err) {
      toast({ title: 'Could not save', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const createUser = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/users', {
        name: form.name.trim(),
        username: form.username.trim().toLowerCase(),
        password: form.password,
        role: form.role,
      })
      toast({ title: 'User created', description: `Login: ${form.username}` })
      setDialogOpen(false)
      setForm({ name: '', username: '', password: '', role: 'OPERATOR' })
      load()
    } catch (err) {
      toast({ title: 'Could not create user', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (user) => {
    try {
      await api.patch(`/users/${user.id}`, { is_active: !user.is_active })
      toast({ title: user.is_active ? 'User deactivated' : 'User activated' })
      load()
    } catch (err) {
      toast({ title: 'Update failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const submitPasswordReset = async (e) => {
    e.preventDefault()
    if (!resetUser) return
    setSaving(true)
    try {
      await api.post(`/users/${resetUser.id}/reset-password`, { new_password: newPassword })
      toast({ title: 'Password updated' })
      setResetUser(null)
      setNewPassword('')
    } catch (err) {
      toast({ title: 'Reset failed', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card id="team-users">
        <CardHeader>
          <CardTitle className="text-base">Team &amp; login users</CardTitle>
          <CardDescription>
            Add operators and admins for your trust. Share the login link below with your team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium">Trust login URL (subdomain)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="trust-slug">Subdomain slug</Label>
                <Input
                  id="trust-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="sanwaliya-seth-deoli"
                />
              </div>
              <div>
                <Label htmlFor="custom-domain">Custom domain (optional)</Label>
                <Input
                  id="custom-domain"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
                  placeholder="accounts.yourtemple.org"
                />
              </div>
            </div>
            {loginUrl ? (
              <p className="text-xs text-muted-foreground break-all">
                Login link: <span className="font-mono text-foreground">{loginUrl}</span>
              </p>
            ) : null}
            <Button size="sm" onClick={saveTenantAccess} disabled={saving || !slug}>
              Save login URL
            </Button>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setDialogOpen(true)}>Add user</Button>
          </div>

          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name}
                      {user.is_self ? (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          You
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{user.username}</code>
                    </TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.last_login ? formatDate(user.last_login) : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'default' : 'secondary'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {!user.is_platform_admin && !user.is_self ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setResetUser(user)}>
                            Reset pwd
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => toggleActive(user)}>
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
            <DialogDescription>Create a login for donation entry, expenses, or administration.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createUser} className="space-y-4">
            <div>
              <Label htmlFor="member-name">Full name</Label>
              <Input
                id="member-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="member-username">Username</Label>
              <Input
                id="member-username"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="member-password">Temporary password</Label>
              <Input
                id="member-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="OPERATOR">Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Create user'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resetUser)} onOpenChange={(open) => !open && setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Set a new password for {resetUser?.username}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPasswordReset} className="space-y-4">
            <div>
              <Label htmlFor="reset-password">New password</Label>
              <Input
                id="reset-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setResetUser(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Update password'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
