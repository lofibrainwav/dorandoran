export const SITE_GATE_COOKIE = 'dorandoran_site_gate'

export interface SiteGateConfig {
  enabled: boolean
  accessCode: string | null
  gateKey: string | null
}

export function siteGateConfig(env: Record<string, string | undefined>): SiteGateConfig {
  const accessCode = env.DORANDORAN_ACCESS_CODE?.trim()
  const gateKey = env.DORANDORAN_GATE_KEY?.trim()
  if (!accessCode || !gateKey) return { enabled: false, accessCode: null, gateKey: null }
  return { enabled: true, accessCode, gateKey }
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const base64 = btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function siteGateToken(accessCode: string, gateKey: string): Promise<string> {
  const input = new TextEncoder().encode(`${accessCode}\n${gateKey}`)
  const digest = await crypto.subtle.digest('SHA-256', input)
  return base64Url(new Uint8Array(digest))
}
export async function siteGateAuthorized(
  cookieValue: string | undefined,
  accessCode: string,
  gateKey: string,
): Promise<boolean> {
  if (!cookieValue) return false
  return cookieValue === await siteGateToken(accessCode, gateKey)
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}
