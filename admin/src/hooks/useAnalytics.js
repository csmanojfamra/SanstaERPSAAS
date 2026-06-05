import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'

export function useAnalyticsDashboard(params = {}) {
  return useQuery({
    queryKey: ['analytics-dashboard', params],
    queryFn: async () => {
      const { data } = await api.get('/analytics/dashboard', { params })
      return data
    },
    refetchInterval: 60 * 1000,
  })
}

export function useAuditActivity(params) {
  return useQuery({
    queryKey: ['audit-activity', params],
    queryFn: async () => {
      const { data } = await api.get('/analytics/activity', { params })
      return data
    },
  })
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/notifications')
      return data
    },
    refetchInterval: 30 * 1000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.post(`/analytics/notifications/${id}/read`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['analytics-dashboard'] })
    },
  })
}

export function useReconciliation(params = {}) {
  return useQuery({
    queryKey: ['reconciliation', params],
    queryFn: async () => {
      const { data } = await api.get('/analytics/reconciliation', { params })
      return data
    },
    refetchInterval: 60 * 1000,
  })
}

function buildReconciliationExportParams(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value)
    }
  })
  return search
}

async function downloadBlob(url, filename, accept) {
  const token = useAuthStore.getState().token
  const response = await fetch(url, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      Accept: accept,
    },
  })
  if (!response.ok) {
    let message = 'Download failed'
    if ((response.headers.get('content-type') || '').includes('application/json')) {
      try {
        const body = await response.json()
        message = body.message || message
      } catch {
        // no-op
      }
    }
    throw new Error(message)
  }
  const blob = await response.blob()
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(objectUrl)
}

export async function downloadReconciliationPdf(params = {}) {
  const search = buildReconciliationExportParams(params)
  await downloadBlob(
    `/api/v1/analytics/reconciliation/export/pdf?${search.toString()}`,
    `bank_reconciliation_register_${new Date().toISOString().slice(0, 10)}.pdf`,
    'application/pdf'
  )
}

export async function downloadAuditActivityPdf(params = {}) {
  const search = buildReconciliationExportParams(params)
  await downloadBlob(
    `/api/v1/analytics/activity/export/pdf?${search.toString()}`,
    `audit_trail_register_${new Date().toISOString().slice(0, 10)}.pdf`,
    'application/pdf'
  )
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/system-health')
      return data
    },
    refetchInterval: 60 * 1000,
  })
}

export function useReceiptStatus() {
  return useQuery({
    queryKey: ['receipt-status'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/receipt-status')
      return data
    },
    refetchInterval: 60 * 1000,
  })
}

export function useReconcileDonation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.post(`/donations/${id}/reconcile`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation'] })
      qc.invalidateQueries({ queryKey: ['analytics-dashboard'] })
      qc.invalidateQueries({ queryKey: ['donations'] })
    },
  })
}

export function useReconcileExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.post(`/expenses/${id}/reconcile`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation'] })
      qc.invalidateQueries({ queryKey: ['analytics-dashboard'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}
