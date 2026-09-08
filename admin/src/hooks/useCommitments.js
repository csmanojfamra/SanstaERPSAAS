import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export function useLifetimePlan() {
  return useQuery({
    queryKey: ['commitment-lifetime-plan'],
    queryFn: async () => {
      const { data } = await api.get('/commitments/plans/lifetime')
      return data
    },
  })
}

export function useUpdateLifetimePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.put('/commitments/plans/lifetime', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commitment-lifetime-plan'] })
      qc.invalidateQueries({ queryKey: ['commitment-summary'] })
    },
  })
}

export function useCommitmentMembers(params) {
  return useQuery({
    queryKey: ['commitment-members', params],
    queryFn: async () => {
      const { data } = await api.get('/commitments/members', { params })
      return data
    },
  })
}

export function useCommitmentMember(id) {
  return useQuery({
    queryKey: ['commitment-member', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await api.get(`/commitments/members/${id}`)
      return data
    },
  })
}

export function useCommitmentSummary() {
  return useQuery({
    queryKey: ['commitment-summary'],
    queryFn: async () => {
      const { data } = await api.get('/commitments/summary')
      return data
    },
  })
}

export function useEnrollMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/commitments/members', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commitment-members'] })
      qc.invalidateQueries({ queryKey: ['commitment-summary'] })
    },
  })
}

export function useRecordMembershipPayment(memberId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(`/commitments/members/${memberId}/payments`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commitment-members'] })
      qc.invalidateQueries({ queryKey: ['commitment-member', memberId] })
      qc.invalidateQueries({ queryKey: ['commitment-summary'] })
      qc.invalidateQueries({ queryKey: ['donations'] })
    },
  })
}

export function useUpdateMemberStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }) => {
      const { data } = await api.patch(`/commitments/members/${id}/status`, { status })
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['commitment-members'] })
      qc.invalidateQueries({ queryKey: ['commitment-member', vars.id] })
      qc.invalidateQueries({ queryKey: ['commitment-summary'] })
    },
  })
}
