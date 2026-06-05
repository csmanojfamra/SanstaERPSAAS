import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'

export function useCashBook({ dateFrom, dateTo, period }) {
  return useQuery({
    queryKey: ['cashbook', period, dateFrom, dateTo],
    queryFn: async () => {
      const params = {}
      if (period) params.period = period
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const { data } = await api.get('/cashbook', { params })
      return data
    },
  })
}

function buildExportParams({ dateFrom, dateTo, channel, period }) {
  const params = new URLSearchParams()
  if (period) params.set('period', period)
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  if (channel) params.set('channel', channel)
  return params
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
        /* ignore */
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

export async function downloadCashbookExcel({ dateFrom, dateTo, channel = 'both', period } = {}) {
  const params = buildExportParams({ dateFrom, dateTo, channel, period })
  const suffix = channel === 'both' ? 'cash_bank' : channel.toLowerCase()
  await downloadBlob(
    `/api/v1/cashbook/export/excel?${params}`,
    `cashbook_${suffix}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
}

export async function downloadCashbookPdf({ dateFrom, dateTo, channel = 'both', period } = {}) {
  const params = buildExportParams({ dateFrom, dateTo, channel, period })
  const suffix = channel === 'both' ? 'cash_bank' : channel.toLowerCase()
  await downloadBlob(
    `/api/v1/cashbook/export/pdf?${params}`,
    `cashbook_${suffix}.pdf`,
    'application/pdf'
  )
}
