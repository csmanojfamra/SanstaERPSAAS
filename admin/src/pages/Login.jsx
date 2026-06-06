import { Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Lock } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { getApiErrorMessage } from '@/lib/api'
import { useTenantLoginBranding } from '@/hooks/useTenantLoginBranding'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/hooks/use-toast'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

const SANSTHAERP_LOGO = `${import.meta.env.BASE_URL}sansthaerp-logo.png`

function SansthaErpFooter({ className }) {
  return (
    <footer className={cn('flex w-full flex-col items-center gap-3 px-4 pb-6 pt-2 sm:pb-8', className)}>
      <a
        href="https://sanstha.fastlegal.in"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full max-w-[360px] rounded-xl bg-white px-5 py-4 shadow-lg ring-1 ring-black/5 transition-opacity hover:opacity-95 sm:px-6 sm:py-5"
        aria-label="SANSTHAERP by FastLegal"
      >
        <img
          src={SANSTHAERP_LOGO}
          alt="FastLegal SANSTHA ERP"
          width={300}
          height={73}
          className="mx-auto h-auto w-full max-h-[72px] object-contain sm:max-h-[84px]"
        />
      </a>
      <p className="text-center text-sm font-bold uppercase tracking-[0.14em] text-white/95 sm:text-[15px]">
        SANSTHAERP{' '}
        <span className="font-semibold tracking-[0.1em] text-white/65">BY FASTLEGAL</span>
      </p>
      <p className="text-[11px] text-white/50">
        <a
          href="https://fastlegal.in"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white/70 hover:underline"
        >
          Fastlegal Technologies Pvt Ltd
        </a>
      </p>
    </footer>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const [error, setError] = useState('')
  const { tenant, loading, primary, secondary, logoUrl, title, subtitle, isWhiteLabel } =
    useTenantLoginBranding()

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
    <div
      className="flex min-h-screen min-h-[100dvh] flex-col"
      style={{
        background: `linear-gradient(155deg, ${primary} 0%, ${secondary} 88%)`,
      }}
    >
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-6 sm:py-8">
        <div className="w-full max-w-[400px]">
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] ring-1 ring-black/5">
            <div
              className="px-6 pb-4 pt-8 text-center sm:px-8"
              style={{ borderBottom: `3px solid ${primary}` }}
            >
              {loading ? (
                <div className="mx-auto mb-4 h-16 w-16 animate-pulse rounded-full bg-muted" />
              ) : isWhiteLabel && logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="mx-auto mb-4 h-16 w-16 rounded-full object-cover ring-2 ring-white shadow-sm sm:h-[4.5rem] sm:w-[4.5rem]"
                />
              ) : (
                <div
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl shadow-sm ring-2 ring-white/80 sm:h-[4.5rem] sm:w-[4.5rem]"
                  style={{ backgroundColor: `${primary}14` }}
                  aria-hidden
                >
                  🛕
                </div>
              )}

              {loading ? (
                <div className="mx-auto mb-2 h-7 w-52 animate-pulse rounded bg-muted" />
              ) : (
                <>
                  <h1
                    className={cn(
                      'text-balance font-bold leading-snug',
                      isWhiteLabel
                        ? 'text-lg sm:text-xl'
                        : 'text-xl uppercase tracking-wide sm:text-2xl'
                    )}
                    style={{ color: secondary }}
                  >
                    {title}
                  </h1>
                  {subtitle ? (
                    <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
                  ) : null}
                </>
              )}

              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 shrink-0 opacity-70" />
                {isWhiteLabel ? 'Trust admin sign in' : 'Secure admin sign in'}
              </p>
            </div>

            <div className="px-6 py-6 sm:px-8">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="space-y-2">
                  <Label
                    htmlFor="username"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Username
                  </Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    autoFocus
                    className="h-11"
                    placeholder="Email or username"
                    {...register('username')}
                  />
                  {errors.username ? (
                    <p className="text-sm text-destructive">{errors.username.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    className="h-11"
                    {...register('password')}
                  />
                  {errors.password ? (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  ) : null}
                </div>
                <Button
                  type="submit"
                  className="h-11 w-full border-0 text-base font-semibold text-white shadow-md transition-opacity hover:opacity-95"
                  style={{ backgroundColor: primary }}
                  disabled={isSubmitting || loading}
                >
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

              {!loading && tenant?.phone ? (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Need help? Call{' '}
                  <a href={`tel:${tenant.phone}`} className="font-medium text-foreground hover:underline">
                    {tenant.phone}
                  </a>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      <SansthaErpFooter />
    </div>
  )
}
