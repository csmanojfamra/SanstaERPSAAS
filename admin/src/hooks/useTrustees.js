import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export function useTrustees() {
  return useQuery({
    queryKey: ['trustees'],
    queryFn: async () => {
      const { data } = await api.get('/trustees')
      return data
    },
  })
}

export function useTrusteeContributions(trusteeId, params) {
  return useQuery({
    queryKey: ['trustee-contributions', trusteeId, params],
    queryFn: async () => {
      const { data } = await api.get(`/trustees/${trusteeId}/contributions`, { params })
      return data
    },
    enabled: !!trusteeId,
  })
}

export function useCreateTrustee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/trustees', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trustees'] }),
  })
}

export function useUpdateTrustee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data } = await api.put(`/trustees/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trustees'] }),
  })
}

export function useDeleteTrustee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/trustees/${id}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trustees'] }),
  })
}

export function useCreateContribution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ trusteeId, ...payload }) => {
      const { data } = await api.post(`/trustees/${trusteeId}/contributions`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trustees'] })
      qc.invalidateQueries({ queryKey: ['trustee-contributions'] })
    },
  })
}

export function useDeleteContribution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ trusteeId, contributionId }) => {
      const { data } = await api.delete(`/trustees/${trusteeId}/contributions/${contributionId}`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trustees'] })
      qc.invalidateQueries({ queryKey: ['trustee-contributions'] })
    },
  })
}
