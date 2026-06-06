import { useEffect, useState } from 'react'
import axios from 'axios'

const DEFAULT_BRAND = {
  primary: '#FF6B00',
  secondary: '#7B1C1C',
}

function resolveLogoUrl(logoUrl) {
  if (!logoUrl) return null
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl
  const base = logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`
  return `${window.location.origin}${base}`
}

export function useTenantLoginBranding() {
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    axios
      .get('/api/v1/public/tenant-config')
      .then(({ data }) => {
        if (!active) return
        setTenant(data?.tenant || null)
      })
      .catch(() => {
        if (active) setTenant(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    document.title = tenant?.login_title
      ? `${tenant.login_title} — Sign in`
      : 'Sign in — SANSTHAERP'
  }, [tenant])

  const primary = tenant?.primary_color || DEFAULT_BRAND.primary
  const secondary = tenant?.secondary_color || DEFAULT_BRAND.secondary
  const isWhiteLabel = Boolean(tenant)

  return {
    tenant,
    loading,
    primary,
    secondary,
    logoUrl: resolveLogoUrl(tenant?.logo_url),
    title: isWhiteLabel ? tenant.login_title || tenant.name : 'Admin Sign In',
    subtitle:
      isWhiteLabel && tenant.name_hindi && tenant.name && tenant.name !== tenant.name_hindi
        ? tenant.name
        : null,
    isWhiteLabel,
  }
}
