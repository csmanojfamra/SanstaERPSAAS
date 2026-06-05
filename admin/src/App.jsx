import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from '@/components/ui/toaster'
import ErrorBoundary from '@/components/ErrorBoundary'
import ProtectedRoute from '@/routes/ProtectedRoute'
import AdminRoute from '@/routes/AdminRoute'
import AppLayout from '@/layouts/AppLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Donations from '@/pages/Donations'
import NewDonation from '@/pages/NewDonation'
import Trustees from '@/pages/Trustees'
import Expenses from '@/pages/Expenses'
import Reports from '@/pages/Reports'
import Reconciliation from '@/pages/Reconciliation'
import AuditLogs from '@/pages/AuditLogs'
import Settings from '@/pages/Settings'
import CashBook from '@/pages/CashBook'
import PlatformRoute from '@/routes/PlatformRoute'
import PlatformLayout from '@/layouts/PlatformLayout'
import PlatformTrusts from '@/pages/platform/Trusts'
import OnboardTrust from '@/pages/platform/OnboardTrust'
import TrustUsers from '@/pages/platform/TrustUsers'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route
                path="platform"
                element={
                  <PlatformRoute>
                    <PlatformLayout />
                  </PlatformRoute>
                }
              >
                <Route index element={<PlatformTrusts />} />
                <Route path="onboard" element={<OnboardTrust />} />
                <Route path="trusts/:trustId/users" element={<TrustUsers />} />
              </Route>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="donations" element={<Donations />} />
                <Route path="donations/new" element={<NewDonation />} />
                <Route path="trustees" element={<Trustees />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="reports" element={<Reports />} />
                <Route path="reconciliation" element={<Reconciliation />} />
                <Route path="audit-logs" element={<AuditLogs />} />
                <Route
                  path="cash-book"
                  element={
                    <AdminRoute>
                      <CashBook />
                    </AdminRoute>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <AdminRoute>
                      <Settings />
                    </AdminRoute>
                  }
                />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
      <Toaster />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
