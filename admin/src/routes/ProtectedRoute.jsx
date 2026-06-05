import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'

export default function ProtectedRoute() {
  const token = useAuthStore((s) => s.token)
  const location = useLocation()
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated())

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true)
      return undefined
    }
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
