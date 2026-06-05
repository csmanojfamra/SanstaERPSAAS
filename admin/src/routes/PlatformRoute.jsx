import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'

export default function PlatformRoute({ children }) {
  const isPlatformAdmin = useAuthStore((s) => s.user?.is_platform_admin)

  if (!isPlatformAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/30">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-6 w-6" />
              <CardTitle>Platform access only</CardTitle>
            </div>
            <CardDescription>
              This console is for Fastlegal platform administrators to onboard trusts and users.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/dashboard">Back to trust admin</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return children
}
