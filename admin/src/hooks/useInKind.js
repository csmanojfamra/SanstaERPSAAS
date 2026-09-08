import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export function useStockItems(includeInactive = false) {
  return useQuery({
    queryKey: ['inkind-items', includeInactive],
    queryFn: async () => {
      const { data } = await api.get('/inkind/items', {
        params: includeInactive ? { include_inactive: '1' } : undefined,
      })
      return data
    },
  })
}

export function useInKindReceipts(params) {
  return useQuery({
    queryKey: ['inkind-receipts', params],
    queryFn: async () => {
      const { data } = await api.get('/inkind/receipts', { params })
      return data
    },
  })
}

export function useStockReport() {
  return useQuery({
    queryKey: ['inkind-stock-report'],
    queryFn: async () => {
      const { data } = await api.get('/inkind/stock-report')
      return data
    },
  })
}

export function useStockMovements(params) {
  return useQuery({
    queryKey: ['inkind-movements', params],
    queryFn: async () => {
      const { data } = await api.get('/inkind/movements', { params })
      return data
    },
  })
}

export function useCreateStockItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/inkind/items', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inkind-items'] })
      qc.invalidateQueries({ queryKey: ['inkind-stock-report'] })
    },
  })
}

export function useCreateInKindReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/inkind/receipts', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inkind-receipts'] })
      qc.invalidateQueries({ queryKey: ['inkind-items'] })
      qc.invalidateQueries({ queryKey: ['inkind-stock-report'] })
      qc.invalidateQueries({ queryKey: ['inkind-movements'] })
    },
  })
}

export function useUtiliseStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/inkind/utilise', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inkind-items'] })
      qc.invalidateQueries({ queryKey: ['inkind-stock-report'] })
      qc.invalidateQueries({ queryKey: ['inkind-movements'] })
    },
  })
}
