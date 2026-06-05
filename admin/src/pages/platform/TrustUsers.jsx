import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, UserPlus } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
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

export default function TrustUsers() {
  const { trustId } = useParams()
  const [trust, setTrust] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'OPERATOR',
  })

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/platform/trusts/${trustId}/users`)
      setTrust(data.trust)
      setUsers(data.users || [])
    } catch (err) {
      toast({ title: 'Failed to load users', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [trustId])

  const toggleActive = async (user) => {
    try {
      await api.patch(`/platform/users/${user.id}`, { is_active: !user.is_active })
      toast({ title: user.is_active ? 'User deactivated' : 'User activated' })
      load()
    } catch (err) {
      toast({ title: 'Update failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const createUser = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/platform/trusts/${trustId}/users`, {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/platform">
            <ArrowLeft className="mr-1 h-4 w-4" />
            All trusts
          </Link>
        </Button>
      </div>

      <PageHeader title={loading ? 'Loading…' : trust?.name || 'Trust users'} description={trust?.name_hindi}>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add user
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Login accounts</CardTitle>
          <CardDescription>
            Users log in at the same admin URL with their username and password. Usernames are unique per trust.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name}
                      {user.is_platform_admin ? (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          Platform
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
                    <TableCell className="text-right">
                      {!user.is_platform_admin ? (
                        <Button variant="outline" size="sm" onClick={() => toggleActive(user)}>
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
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
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>Create a new login for {trust?.name || 'this trust'}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createUser} className="space-y-4">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
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
                  <SelectItem value="ADMIN">Admin — full trust access</SelectItem>
                  <SelectItem value="OPERATOR">Operator — day-to-day entry</SelectItem>
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
    </div>
  )
}
