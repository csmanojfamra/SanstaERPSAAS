/** Trust login URLs for Settings → Team (client branding handled on their websites later). */
export function buildTrustLoginUrl(slug) {
  if (!slug) return `${window.location.origin}${import.meta.env.BASE_URL}login`
  return `${window.location.origin}${import.meta.env.BASE_URL}login`
}

// Kept for SettingsTeamUsers import compatibility
export const buildLocalTenantLoginUrl = buildTrustLoginUrl
