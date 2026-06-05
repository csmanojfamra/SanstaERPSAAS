import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import axios from 'axios'
import { useAuthStore } from '@/store/useAuthStore'
import { getApiErrorMessage } from '@/lib/api'
import { getTenantSlugFromHost } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/hooks/use-toast'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

const publicApi = axios.create({ baseURL: '/api/v1' })

export default function Login() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const [error, setError] = useState('')
  const [tenant, setTenant] = useState(null)
  const [tenantLoading, setTenantLoading] = useState(true)
  const tenantSlug = getTenantSlugFromHost()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  })

  useEffect(() => {
    let cancelled = false
    const loadTenant = async () => {
      setTenantLoading(true)
      try {
        const headers = {}
        if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug
        const { data } = await publicApi.get('/public/tenant-config', {
          headers,
          params: tenantSlug ? { tenant: tenantSlug } : undefined,
        })
        if (!cancelled) setTenant(data.tenant || null)
      } catch {
        if (!cancelled) setTenant(null)
      } finally {
        if (!cancelled) setTenantLoading(false)
      }
    }
    loadTenant()
    return () => {
      cancelled = true
    }
  }, [tenantSlug])

  const pageStyle = useMemo(() => {
    if (!tenant?.primary_color || !tenant?.secondary_color) return undefined
    return {
      background: `linear-gradient(135deg, ${tenant.primary_color} 0%, ${tenant.secondary_color} 100%)`,
    }
  }, [tenant])

  if (token) {
    return <Navigate to={user?.is_platform_admin ? '/platform' : '/dashboard'} replace />
  }

  const onSubmit = async (values) => {
    setError('')
    try {
      const data = await login(values.username, values.password)
      toast({ title: 'Welcome back', description: 'Login successful' })
      navigate(data.user?.is_platform_admin ? '/platform' : '/dashboard', { replace: true })
    } catch (err) {
      const msg = getApiErrorMessage(err)
      setError(msg)
      toast({ title: 'Login failed', description: msg })
    }
  }

  const title = tenant?.login_title || tenant?.name_hindi || tenant?.name || 'Temple Trust Admin'
  const subtitle = tenant
    ? 'Secure trust administration login'
    : 'Fastlegal Technologies — Secure login'

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-saffron via-saffron-light to-maroon p-4"
      style={pageStyle}
    >
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt="" className="mx-auto mb-2 h-16 w-16 object-contain" />
          ) : (
            <div className="mx-auto mb-2 text-4xl">🛕</div>
          )}
          <CardTitle className="text-maroon">{tenantLoading ? 'Loading…' : title}</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
          {tenantSlug && !tenant && !tenantLoading ? (
            <p className="mt-2 text-xs text-amber-700">
              Trust &quot;{tenantSlug}&quot; not found. Sign in without ?tenant= or check the slug.
            </p>
          ) : null}
          {window.location.hostname === 'localhost' && !tenantSlug ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Dev tip: optional branding with{' '}
              <code className="rounded bg-muted px-1">?tenant=sanwaliya-seth-deoli</code>
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" autoComplete="username" {...register('username')} />
              {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
