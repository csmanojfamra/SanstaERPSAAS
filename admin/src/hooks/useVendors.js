import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export function useVendors(search = '') {
  return useQuery({
    queryKey: ['vendors', search],
    queryFn: async () => {
      const { data } = await api.get('/vendors', {
        params: search ? { search } : undefined,
      })
      return data.vendors || []
    },
  })
}

export function useCreateVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/vendors', payload)
      return data.vendor
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] })
    },
  })
}
