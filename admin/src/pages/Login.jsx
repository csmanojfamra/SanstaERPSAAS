import { Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { getApiErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/hooks/use-toast'
import { useState } from 'react'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export default function Login() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  })

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-saffron via-saffron-light to-maroon p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 text-4xl">🛕</div>
          <CardTitle className="text-maroon">Temple Trust Admin</CardTitle>
          <CardDescription>Fastlegal Technologies — Secure login</CardDescription>
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
