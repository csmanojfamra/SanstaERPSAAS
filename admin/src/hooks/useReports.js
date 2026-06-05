import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useFinancialSummary() {
  return useQuery({
    queryKey: ['financial-summary'],
    queryFn: async () => {
      const { data } = await api.get('/reports/financial-summary')
      return data
    },
  })
}

export function useDailySummary(date) {
  return useQuery({
    queryKey: ['daily-summary', date],
    queryFn: async () => {
      const { data } = await api.get('/reports/daily-summary', { params: { date } })
      return data
    },
  })
}

export function useDateRangeReport(params) {
  return useQuery({
    queryKey: ['date-range-report', params],
    queryFn: async () => {
      const { data } = await api.get('/reports/date-range', { params })
      return data
    },
    enabled: !!(params?.date_from && params?.date_to),
  })
}

export function usePaymentModeSummary(params) {
  return useQuery({
    queryKey: ['payment-mode-summary', params],
    queryFn: async () => {
      const { data } = await api.get('/reports/payment-mode-summary', { params })
      return data
    },
    enabled: !!(params?.date_from && params?.date_to),
  })
}

export function useExpenseSummary(params) {
  return useQuery({
    queryKey: ['expense-summary', params],
    queryFn: async () => {
      const { data } = await api.get('/reports/expense-summary', { params })
      return data
    },
    enabled: !!(params?.date_from && params?.date_to),
  })
}

export function useTrusteeContributionsReport() {
  return useQuery({
    queryKey: ['trustee-contributions-report'],
    queryFn: async () => {
      const { data } = await api.get('/reports/trustee-contributions')
      return data
    },
  })
}

export async function exportExcel(type, params = {}) {
  const response = await api.get('/reports/export-excel', {
    params: { type, ...params },
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(
    new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `${type}_report.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function exportPdf(type, params = {}) {
  const response = await api.get('/reports/export-pdf', {
    params: { type, ...params },
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(
    new Blob([response.data], {
      type: 'application/pdf',
    })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `${type}_report.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
