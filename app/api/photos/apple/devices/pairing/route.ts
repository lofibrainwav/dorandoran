import type { NextRequest } from 'next/server'
import { createApplePhotoPairingCode, deviceAuthSecret, hashApplePhotoDeviceSecret, APPLE_PHOTO_PAIRING_TTL_MS } from '@/lib/server/apple-photo-device-auth'
import { assertSameOrigin, resolveLifecycleContext } from '@/lib/server/lifecycle-runtime'
import { resolvePostgresConnectionString } from '@/lib/server/postgres-connection'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

/** Creates a one-use QR payload for an authenticated adult household member. */
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return Response.json({ error: 'ORIGIN_DENIED' }, { status: 403, headers })
  const context = await resolveLifecycleContext(request)
  if ('error' in context) return Response.json({ error: context.error }, { status: context.error === 'AUTH_REQUIRED' ? 401 : 503, headers })
  if (context.viewer.access !== 'adult') return Response.json({ error: 'ADULT_REQUIRED' }, { status: 403, headers })

  const connectionString = resolvePostgresConnectionString({ DATABASE_URL: process.env.DATABASE_URL, POSTGRES_URL: process.env.POSTGRES_URL })
  if (!connectionString) return Response.json({ error: 'APPLE_PHOTO_DATABASE_REQUIRED' }, { status: 503, headers })
  const code = createApplePhotoPairingCode()
  const expiresAt = new Date(Date.now() + APPLE_PHOTO_PAIRING_TTL_MS)
  const pairingId = crypto.randomUUID()
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000 })
  try {
    await pool.query(
      `INSERT INTO apple_photo_pairing
        (pairing_id, library_scope, code_hash, created_by_person_id, expires_at)
       VALUES ($1, 'family-shared', $2, $3, $4)`,
      [pairingId, hashApplePhotoDeviceSecret(code, deviceAuthSecret()), context.viewer.personId, expiresAt.toISOString()],
    )
    return Response.json({ pairingCode: code, expiresAt: expiresAt.toISOString(), libraryScope: 'family-shared' }, { status: 201, headers })
  } catch {
    return Response.json({ error: 'APPLE_PHOTO_PAIRING_FAILED' }, { status: 503, headers })
  } finally {
    await pool.end()
  }
}

