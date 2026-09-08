import type { HouseholdMember } from '../family-os/google-household-identity.ts'

export const HOUSEHOLD_SESSION_COOKIE = 'dorandoran_household_v1'
export const HOUSEHOLD_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export interface HouseholdSessionClaims {
  googleSub: string
  expiresAt: number
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  try {
    const binary = atob(base64)
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    return null
  }
}

function encodeText(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value))
}

function decodeText(value: string): string | null {
  const bytes = base64UrlToBytes(value)
  if (!bytes) return null
  try {
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return bytesToBase64Url(new Uint8Array(signature))
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

export async function householdSessionToken(
  googleSub: string,
  authSecret: string,
  expiresAt: number,
): Promise<string> {
  const subject = googleSub.trim()
  const secret = authSecret.trim()
  if (!subject || !secret || !Number.isFinite(expiresAt)) throw new Error('INVALID_HOUSEHOLD_SESSION_INPUT')
  const payload = `${Math.floor(expiresAt)}.${encodeText(subject)}`
  return `${payload}.${await hmac(payload, secret)}`
}

export async function verifyHouseholdSessionToken(
  token: string | undefined,
  authSecret: string,
  now: number,
): Promise<HouseholdSessionClaims | null> {
  const secret = authSecret.trim()
  if (!token || !secret) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [expiresRaw, encodedSubject, signature] = parts
  if (!/^\d+$/.test(expiresRaw)) return null
  const expiresAt = Number(expiresRaw)
  if (!Number.isFinite(expiresAt) || now >= expiresAt) return null
  const googleSub = decodeText(encodedSubject)?.trim()
  if (!googleSub) return null
  const payload = `${expiresRaw}.${encodedSubject}`
  const expected = await hmac(payload, secret)
  if (!safeEqual(signature, expected)) return null
  return { googleSub, expiresAt }
}

export async function resolveHouseholdSessionMember(
  token: string | undefined,
  authSecret: string,
  membership: HouseholdMember[],
  now: number,
): Promise<HouseholdMember | null> {
  const claims = await verifyHouseholdSessionToken(token, authSecret, now)
  if (!claims) return null
  const member = membership.find((candidate) => candidate.googleSub === claims.googleSub) ?? null
  return member?.canSignIn ? member : null
}
