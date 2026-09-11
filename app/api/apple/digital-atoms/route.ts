import type { NextRequest } from 'next/server'
import { resolvePostgresConnectionString } from '@/lib/server/postgres-connection'
import { authorizationBearer, deviceAuthSecret, hashApplePhotoDeviceSecret, parseApplePhotoDeviceToken } from '@/lib/server/apple-photo-device-auth'
import { createPostgresAppleDigitalAtomStore } from '@/lib/server/apple-digital-atom-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

/** Accepts metadata-only Apple Calendar/Reminders/Shortcuts/Home batches from a paired device. */
export async function POST(request: NextRequest) {
  const bearer = authorizationBearer(request.headers.get('authorization'))
  const deviceToken = parseApplePhotoDeviceToken(bearer)
  if (!deviceToken) return Response.json({ error: 'APPLE_DIGITAL_ATOM_DEVICE_REQUIRED' }, { status: 401, headers })

  const connectionString = resolvePostgresConnectionString({ DATABASE_URL: process.env.DATABASE_URL, POSTGRES_URL: process.env.POSTGRES_URL })
  if (!connectionString) return Response.json({ error: 'APPLE_DIGITAL_ATOM_DATABASE_REQUIRED' }, { status: 503, headers })

  let body: unknown
  try { body = await request.json() } catch { return Response.json({ error: 'BODY_INVALID' }, { status: 400, headers }) }

  let authSecret: string
  try { authSecret = deviceAuthSecret() } catch { return Response.json({ error: 'APPLE_DIGITAL_ATOM_DEVICE_AUTH_UNAVAILABLE' }, { status: 503, headers }) }
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000 })
  try {
    const device = await pool.query(
      `SELECT device_id
         FROM apple_photo_device
        WHERE device_id = $1 AND token_hash = $2 AND revoked_at IS NULL`,
      [deviceToken.deviceId, hashApplePhotoDeviceSecret(bearer ?? '', authSecret)],
    )
    if (!device.rowCount) return Response.json({ error: 'APPLE_DIGITAL_ATOM_DEVICE_UNAUTHORIZED' }, { status: 401, headers })

    const store = createPostgresAppleDigitalAtomStore({
      transaction: async (run) => {
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          const result = await run((text, params) => client.query(text, params))
          await client.query('COMMIT')
          return result
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {})
          throw error
        } finally {
          client.release()
        }
      },
    })
    const result = await store.ingest(body)
    return Response.json(result, { status: result.status === 'duplicate' ? 200 : 201, headers })
  } catch (error) {
    const code = error instanceof Error && error.message === 'APPLE_DIGITAL_ATOM_BATCH_INVALID'
      ? error.message
      : 'APPLE_DIGITAL_ATOM_INGEST_FAILED'
    return Response.json({ error: code }, { status: code === 'APPLE_DIGITAL_ATOM_BATCH_INVALID' ? 400 : 503, headers })
  } finally {
    await pool.end()
  }
}
