export const SITE_GATE_COOKIE = 'dorandoran_site_gate'
export const SITE_GATE_SESSION_PARAM = '__dd_session'
export const SITE_GATE_SESSION_MAX_AGE_SECONDS = 60 * 60

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

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

async function hmacBase64Url(key: string, value: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value))
  return base64Url(new Uint8Array(signature))
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
  return safeEqual(cookieValue, await siteGateToken(accessCode, gateKey))
}

export async function siteGateSessionToken(gateKey: string, expiresAtMs: number): Promise<string> {
  const expiresAtSeconds = Math.floor(expiresAtMs / 1000)
  if (!Number.isSafeInteger(expiresAtSeconds) || expiresAtSeconds <= 0) throw new Error('SITE_GATE_SESSION_EXPIRY_INVALID')
  const payload = String(expiresAtSeconds)
  return `${payload}.${await hmacBase64Url(gateKey, `session:${payload}`)}`
}

export async function siteGateSessionAuthorized(
  value: string | null | undefined,
  gateKey: string,
  nowMs: number,
): Promise<boolean> {
  if (!value) return false
  const [expiresRaw, signature, extra] = value.split('.')
  if (!expiresRaw || !signature || extra !== undefined || !/^\d+$/.test(expiresRaw)) return false
  const expiresAtSeconds = Number(expiresRaw)
  if (!Number.isSafeInteger(expiresAtSeconds) || expiresAtSeconds <= Math.floor(nowMs / 1000)) return false
  const expected = await hmacBase64Url(gateKey, `session:${expiresRaw}`)
  return safeEqual(signature, expected)
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}
