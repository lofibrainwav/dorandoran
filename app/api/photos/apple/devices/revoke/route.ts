import type { NextRequest } from 'next/server'
import { assertSameOrigin, resolveLifecycleContext } from '@/lib/server/lifecycle-runtime'
import { resolvePostgresConnectionString } from '@/lib/server/postgres-connection'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return Response.json({ error: 'ORIGIN_DENIED' }, { status: 403, headers })
  const context = await resolveLifecycleContext(request)
  if ('error' in context) return Response.json({ error: context.error }, { status: context.error === 'AUTH_REQUIRED' ? 401 : 503, headers })
  if (context.viewer.access !== 'adult') return Response.json({ error: 'ADULT_REQUIRED' }, { status: 403, headers })
  let body: unknown
  try { body = await request.json() } catch { return Response.json({ error: 'BODY_INVALID' }, { status: 400, headers }) }
  const deviceId = body && typeof body === 'object' && !Array.isArray(body) && typeof (body as Record<string, unknown>).deviceId === 'string'
    ? (body as Record<string, string>).deviceId.trim()
    : ''
  if (!/^[0-9a-f-]{20,80}$/i.test(deviceId)) return Response.json({ error: 'BODY_INVALID' }, { status: 400, headers })
  const connectionString = resolvePostgresConnectionString({ DATABASE_URL: process.env.DATABASE_URL, POSTGRES_URL: process.env.POSTGRES_URL })
  if (!connectionString) return Response.json({ error: 'APPLE_PHOTO_DATABASE_REQUIRED' }, { status: 503, headers })
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000 })
  try {
    const result = await pool.query(
      `UPDATE apple_photo_device
          SET revoked_at = COALESCE(revoked_at, now())
        WHERE device_id = $1 AND revoked_at IS NULL
       RETURNING device_id`,
      [deviceId],
    )
    return Response.json({ revoked: Boolean(result.rowCount), deviceId }, { status: 200, headers })
  } catch {
    return Response.json({ error: 'APPLE_PHOTO_DEVICE_REVOKE_FAILED' }, { status: 503, headers })
  } finally {
    await pool.end()
  }
}

