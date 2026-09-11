import type { NextRequest } from 'next/server'
import { createApplePhotoDeviceToken, deviceAuthSecret, hashApplePhotoDeviceSecret } from '@/lib/server/apple-photo-device-auth'
import { resolvePostgresConnectionString } from '@/lib/server/postgres-connection'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

function bodyFields(value: unknown): { pairingCode: string; deviceName: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.pairingCode !== 'string' || typeof record.deviceName !== 'string') return null
  const pairingCode = record.pairingCode.trim()
  const deviceName = record.deviceName.trim()
  if (!/^dd_pair_v1\.[A-Za-z0-9_-]{32,}$/.test(pairingCode) || !deviceName || deviceName.length > 120) return null
  return { pairingCode, deviceName }
}

/** Consumes a QR payload once and returns the device token exactly once. */
export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch { return Response.json({ error: 'BODY_INVALID' }, { status: 400, headers }) }
  const fields = bodyFields(body)
  if (!fields) return Response.json({ error: 'BODY_INVALID' }, { status: 400, headers })
  const connectionString = resolvePostgresConnectionString({ DATABASE_URL: process.env.DATABASE_URL, POSTGRES_URL: process.env.POSTGRES_URL })
  if (!connectionString) return Response.json({ error: 'APPLE_PHOTO_DATABASE_REQUIRED' }, { status: 503, headers })

  let authSecret: string
  try { authSecret = deviceAuthSecret() } catch { return Response.json({ error: 'APPLE_PHOTO_DEVICE_AUTH_UNAVAILABLE' }, { status: 503, headers }) }
  const deviceId = crypto.randomUUID()
  const issued = createApplePhotoDeviceToken(deviceId)
  const tokenHash = hashApplePhotoDeviceSecret(issued.token, authSecret)
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000 })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const pairing = await client.query(
      `UPDATE apple_photo_pairing
          SET consumed_at = now()
        WHERE code_hash = $1
          AND consumed_at IS NULL
          AND expires_at > now()
       RETURNING library_scope, created_by_person_id`,
      [hashApplePhotoDeviceSecret(fields.pairingCode, authSecret)],
    )
    if (!pairing.rowCount) {
      await client.query('ROLLBACK')
      return Response.json({ error: 'APPLE_PHOTO_PAIRING_INVALID' }, { status: 401, headers })
    }
    const row = pairing.rows[0]
    await client.query(
      `INSERT INTO apple_photo_device
        (device_id, library_scope, device_name, token_hash, created_by_person_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [deviceId, row.library_scope, fields.deviceName, tokenHash, row.created_by_person_id],
    )
    await client.query('COMMIT')
    return Response.json({ deviceId, deviceToken: issued.token, libraryScope: row.library_scope }, { status: 201, headers })
  } catch {
    await client.query('ROLLBACK').catch(() => {})
    return Response.json({ error: 'APPLE_PHOTO_DEVICE_CLAIM_FAILED' }, { status: 503, headers })
  } finally {
    client.release()
    await pool.end()
  }
}
