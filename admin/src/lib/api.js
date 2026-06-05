import axios from 'axios'
import { useAuthStore } from '@/store/useAuthStore'
import { getTenantSlugFromHost } from '@/lib/tenant'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const slug = getTenantSlugFromHost()
  if (slug) {
    config.headers['X-Tenant-Slug'] = slug
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Something went wrong'

    if (error.response?.status === 401) {
      const { logout } = useAuthStore.getState()
      logout()
      const base = import.meta.env.BASE_URL || '/'
      const loginPath = `${base.replace(/\/$/, '')}/login`
      if (!window.location.pathname.endsWith('/login')) {
        window.location.href = loginPath
      }
    }

    error.apiMessage = message
    return Promise.reject(error)
  }
)

export function getApiErrorMessage(error) {
  return error?.apiMessage || error?.response?.data?.message || 'Request failed'
}

export default api
