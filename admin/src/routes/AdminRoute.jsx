import { useAuthStore } from '@/store/useAuthStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldAlert } from 'lucide-react'

export default function AdminRoute({ children }) {
  const userRole = useAuthStore((s) => s.user?.role)

  if (userRole !== 'ADMIN') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive/30">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-6 w-6" />
              <CardTitle>Access Denied</CardTitle>
            </div>
            <CardDescription>
              This section is restricted to administrators only. Contact your trust admin if you need access.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your current role does not have permission to view this page.
          </CardContent>
        </Card>
      </div>
    )
  }

  return children
}
