import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Users, Building2 } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import api, { getApiErrorMessage } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
export default function PlatformTrusts() {
  const [trusts, setTrusts] = useState([])
  const [loading, setLoading] = useState(true)

  const loadTrusts = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/platform/trusts')
      setTrusts(data.trusts || [])
    } catch (err) {
      toast({ title: 'Failed to load trusts', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrusts()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Trusts & Temples" description="All clients onboarded on the platform. Manage users for each trust.">
        <Button asChild>
          <Link to="/platform/onboard">
            <Plus className="mr-2 h-4 w-4" />
            Onboard new trust
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
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
                      <Badge variant={trust.is_active ? 'default' : 'secondary'}>
                        {trust.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/platform/trusts/${trust.id}/users`}>
                          <Users className="mr-1.5 h-3.5 w-3.5" />
                          Users
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!loading && trusts.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Created dates shown in trust detail. Oldest trusts appear last in the list.
        </p>
      ) : null}
    </div>
  )
}
