import { createHmac, randomBytes } from 'node:crypto'

export const APPLE_PHOTO_PAIRING_TTL_MS = 60 * 1000

function secret(value: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error('APPLE_PHOTO_DEVICE_AUTH_SECRET_REQUIRED')
  return normalized
}

export function deviceAuthSecret(env: Record<string, string | undefined> = process.env): string {
  return secret(env.DORANDORAN_DEVICE_AUTH_SECRET ?? env.DORANDORAN_AUTH_SECRET ?? '')
}

export function randomUrlSecret(bytes = 32): string {
  if (!Number.isInteger(bytes) || bytes < 16 || bytes > 64) throw new Error('APPLE_PHOTO_RANDOM_BYTES_INVALID')
  return randomBytes(bytes).toString('base64url')
}

export function hashApplePhotoDeviceSecret(value: string, authSecret: string): string {
  return createHmac('sha256', secret(authSecret)).update(value).digest('hex')
}

export function createApplePhotoPairingCode(): string {
  return `dd_pair_v1.${randomUrlSecret()}`
}

export function createApplePhotoDeviceToken(deviceId: string): { token: string; hash: string } {
  const normalizedId = deviceId.trim()
  if (!normalizedId) throw new Error('APPLE_PHOTO_DEVICE_ID_REQUIRED')
  const token = `dd_device_v1.${normalizedId}.${randomUrlSecret()}`
  return { token, hash: token }
}

export function parseApplePhotoDeviceToken(value: string | null | undefined): { deviceId: string } | null {
  const token = value?.trim() ?? ''
  const match = /^dd_device_v1\.([A-Za-z0-9_-]{8,128})\.[A-Za-z0-9_-]{32,128}$/.exec(token)
  return match ? { deviceId: match[1] } : null
}

export function authorizationBearer(value: string | null): string | null {
  if (!value) return null
  const match = /^Bearer\s+(.+)$/i.exec(value.trim())
  return match?.[1]?.trim() || null
}

