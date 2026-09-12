import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'

export function useAccounts(filters = {}) {
  return useQuery({
    queryKey: ['accounting', 'accounts', filters],
    queryFn: async () => {
      const { data } = await api.get('/accounting/accounts', { params: filters })
      return data?.accounts || []
    },
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/accounting/accounts', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'accounts'] })
    },
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data } = await api.put(`/accounting/accounts/${id}`, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'accounts'] })
    },
  })
}

export function useJournals(filters = {}) {
  return useQuery({
    queryKey: ['accounting', 'journals', filters],
    queryFn: async () => {
      const { data } = await api.get('/accounting/journals', { params: filters })
      return data
    },
  })
}

export function useJournal(id) {
  return useQuery({
    queryKey: ['accounting', 'journal', id],
    queryFn: async () => {
      if (!id) return null
      const { data } = await api.get(`/accounting/journals/${id}`)
      return data?.entry
    },
    enabled: Boolean(id),
  })
}

export function useCreateJournal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/accounting/journals', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'journals'] })
      queryClient.invalidateQueries({ queryKey: ['accounting', 'ledger'] })
      queryClient.invalidateQueries({ queryKey: ['accounting', 'reports'] })
    },
  })
}

export function useReverseJournal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.post(`/accounting/journals/${id}/reverse`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'journals'] })
      queryClient.invalidateQueries({ queryKey: ['accounting', 'ledger'] })
      queryClient.invalidateQueries({ queryKey: ['accounting', 'reports'] })
    },
  })
}

export function useAccountLedger(accountId, filters = {}) {
  return useQuery({
    queryKey: ['accounting', 'ledger', accountId, filters],
    queryFn: async () => {
      if (!accountId) return null
      const { data } = await api.get(`/accounting/ledger/${accountId}`, { params: filters })
      return data?.ledger
    },
    enabled: Boolean(accountId),
  })
}

export function useBackfillAccounting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/accounting/backfill')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })
}

export function useTrialBalance(filters = {}) {
  return useQuery({
    queryKey: ['accounting', 'reports', 'trial-balance', filters],
    queryFn: async () => {
      const { data } = await api.get('/accounting/reports/trial-balance', { params: filters })
      return data?.report
    },
  })
}

export function useIncomeExpenditure(filters = {}) {
  return useQuery({
    queryKey: ['accounting', 'reports', 'income-expenditure', filters],
    queryFn: async () => {
      const { data } = await api.get('/accounting/reports/income-expenditure', { params: filters })
      return data?.report
    },
  })
}

export function useStatementOfAffairs(filters = {}) {
  return useQuery({
    queryKey: ['accounting', 'reports', 'statement-of-affairs', filters],
    queryFn: async () => {
      const { data } = await api.get('/accounting/reports/statement-of-affairs', { params: filters })
      return data?.report
    },
  })
}

export async function exportAccountingExcel(reportType, params = {}) {
  const token = useAuthStore.getState().token
  const searchParams = new URLSearchParams()
  if (params.fy) searchParams.set('fy', params.fy)
  if (params.date_from) searchParams.set('date_from', params.date_from)
  if (params.date_to) searchParams.set('date_to', params.date_to)
  if (params.as_of_date) searchParams.set('as_of_date', params.as_of_date)

  const url = `${import.meta.env.VITE_API_URL || '/api/v1'}/accounting/reports/export/${reportType}?${searchParams.toString()}`

  const response = await fetch(url, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  })

  if (!response.ok) {
    let message = 'Export failed'
    try {
      const body = await response.json()
      message = body.message || message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') || ''
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/)
  const filename = filenameMatch ? filenameMatch[1] : `${reportType}.xlsx`

  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}
