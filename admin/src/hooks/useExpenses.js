import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export function useExpenses(params) {
  return useQuery({
    queryKey: ['expenses', params],
    queryFn: async () => {
      const { data } = await api.get('/expenses', { params })
      return data
    },
  })
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const { data } = await api.get('/expenses/categories')
      return data.categories
    },
    staleTime: 1000 * 60 * 60,
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/expenses', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/expenses/${id}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put(`/expenses/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export async function downloadExpenseVoucherPdf(expenseId, voucherNumber) {
  const blob = await fetchExpenseVoucherBlob(expenseId)
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${(voucherNumber || 'expense-voucher').replace(/\//g, '-')}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function fetchExpenseVoucherBlob(expenseId) {
  const response = await api.get(`/expenses/${expenseId}/voucher/pdf`, {
    responseType: 'blob',
  })
  return response.data
}
