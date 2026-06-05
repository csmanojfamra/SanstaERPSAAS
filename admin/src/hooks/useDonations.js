import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'

export function useDonations(params) {
  return useQuery({
    queryKey: ['donations', params],
    queryFn: async () => {
      const { data } = await api.get('/donations', { params })
      return data
    },
  })
}

export function useDonation(id) {
  return useQuery({
    queryKey: ['donation', id],
    queryFn: async () => {
      const { data } = await api.get(`/donations/${id}`)
      return data.donation
    },
    enabled: !!id,
  })
}

export function useDonationDetail(id) {
  return useQuery({
    queryKey: ['donation-detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/donations/${id}/detail`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateDonation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/donations', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['donations'] }),
  })
}

export function useUpdateDonation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data } = await api.put(`/donations/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['donations'] })
      qc.invalidateQueries({ queryKey: ['donation'] })
    },
  })
}

export function useDeleteDonation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/donations/${id}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['donations'] }),
  })
}

export function useSendWhatsApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.post(`/donations/${id}/send-whatsapp`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['donations'] })
      qc.invalidateQueries({ queryKey: ['donation-detail'] })
    },
  })
}

export function useRegenerateReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.post(`/donations/${id}/regenerate-receipt`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['donations'] })
      qc.invalidateQueries({ queryKey: ['donation-detail'] })
    },
  })
}

export async function exportDonationsExcel(params = {}) {
  const response = await api.get('/reports/export-excel', {
    params: { type: 'donations', ...params },
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(
    new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `donation_register_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function exportDonationsPdf(params = {}) {
  const response = await api.get('/reports/export-pdf', {
    params: { type: 'donations', ...params },
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `donation_register_${new Date().toISOString().slice(0, 10)}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function isPdfBuffer(buffer) {
  if (!buffer || buffer.byteLength < 500) return false
  const bytes = new Uint8Array(buffer)
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 // F
  )
}

async function fetchReceiptPdf(id, token, { regenerate = false } = {}) {
  if (regenerate) {
    try {
      await fetch(`/api/v1/donations/${id}/regenerate-receipt`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      })
    } catch {
      /* ignore regenerate errors */
    }
  }

  const response = await fetch(`/api/v1/donations/${id}/receipt`, {
    method: 'GET',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'application/pdf',
    },
  })

  const contentType = response.headers.get('content-type') || ''

  if (!response.ok) {
    let message = 'Failed to download receipt'
    if (contentType.includes('application/json')) {
      try {
        const body = await response.json()
        message = body.message || message
      } catch {
        /* ignore */
      }
    }
    return { ok: false, message, buffer: null }
  }

  const buffer = await response.arrayBuffer()
  if (!isPdfBuffer(buffer)) {
    return { ok: false, message: 'Receipt not ready yet', buffer: null }
  }

  return { ok: true, buffer }
}

/** Download receipt PDF — uses fetch (not axios) so binary is not corrupted. */
export async function downloadReceipt(id, receiptNumber) {
  const token = useAuthStore.getState().token

  // Regenerate once so template updates apply; retry download if PDF still generating.
  let lastError = 'Failed to download receipt'
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = await fetchReceiptPdf(id, token, { regenerate: attempt === 0 })
    if (result.ok) {
      const buffer = result.buffer

      const blob = new Blob([buffer], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${(receiptNumber || 'receipt').replace(/\//g, '-')}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      return
    }
    lastError = result.message
    await new Promise((r) => setTimeout(r, 800))
  }

  throw new Error(
    lastError === 'Receipt not ready yet'
      ? 'Receipt is still being generated. Please try again in a few seconds.'
      : lastError
  )
}
