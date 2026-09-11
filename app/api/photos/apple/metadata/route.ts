import type { NextRequest } from 'next/server'
import { assertSameOrigin, resolveLifecycleContext } from '@/lib/server/lifecycle-runtime'
import { createPostgresApplePhotoStreamStore } from '@/lib/server/apple-photo-stream-store'
import { resolvePostgresConnectionString } from '@/lib/server/postgres-connection'
import { authorizationBearer, deviceAuthSecret, hashApplePhotoDeviceSecret, parseApplePhotoDeviceToken } from '@/lib/server/apple-photo-device-auth'
import { parseApplePhotoMetadataBatch } from '@/lib/family-os/apple-photo-stream'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

/** Accepts PhotoKit metadata deltas from either the web family session or a registered device. */
export async function POST(request: NextRequest) {
  const bearer = authorizationBearer(request.headers.get('authorization'))
  const deviceToken = parseApplePhotoDeviceToken(bearer)
  if (!deviceToken && !assertSameOrigin(request)) return Response.json({ error: 'ORIGIN_DENIED' }, { status: 403, headers })
  const context = deviceToken ? null : await resolveLifecycleContext(request)
  if (context && 'error' in context) return Response.json({ error: context.error }, { status: context.error === 'AUTH_REQUIRED' ? 401 : 503, headers })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'BODY_INVALID' }, { status: 400, headers })
  }

  const connectionString = resolvePostgresConnectionString({ DATABASE_URL: process.env.DATABASE_URL, POSTGRES_URL: process.env.POSTGRES_URL })
  if (!connectionString) return Response.json({ error: 'APPLE_PHOTO_DATABASE_REQUIRED' }, { status: 503, headers })

  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000 })
  try {
    const batch = parseApplePhotoMetadataBatch(body)
    if (!batch) return Response.json({ error: 'APPLE_PHOTO_BATCH_INVALID' }, { status: 400, headers })
    if (deviceToken) {
      const device = await pool.query(
        `SELECT device_id, library_scope FROM apple_photo_device
          WHERE device_id = $1 AND token_hash = $2 AND revoked_at IS NULL`,
        [deviceToken.deviceId, hashApplePhotoDeviceSecret(bearer ?? '', deviceAuthSecret())],
      )
      if (!device.rowCount || device.rows[0].library_scope !== batch.libraryScope || device.rows[0].device_id !== batch.deviceId) {
        return Response.json({ error: 'APPLE_PHOTO_DEVICE_UNAUTHORIZED' }, { status: 401, headers })
      }
      await pool.query('UPDATE apple_photo_device SET last_seen_at = now() WHERE device_id = $1', [deviceToken.deviceId])
    }
    const store = createPostgresApplePhotoStreamStore({
      query: (text, params) => pool.query(text, params),
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
    const code = error instanceof Error && error.message === 'APPLE_PHOTO_BATCH_INVALID' ? error.message : 'APPLE_PHOTO_INGEST_FAILED'
    return Response.json({ error: code }, { status: code === 'APPLE_PHOTO_BATCH_INVALID' ? 400 : 503, headers })
  } finally {
    await pool.end()
  }
}
