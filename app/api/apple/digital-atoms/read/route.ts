import type { NextRequest } from 'next/server'
import { resolveLifecycleContext } from '@/lib/server/lifecycle-runtime'
import { resolvePostgresConnectionString } from '@/lib/server/postgres-connection'
import { loadAppleDigitalAtomProjection } from '@/lib/server/apple-digital-atom-read'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

/** Returns only source connection state; Apple metadata payloads never cross this boundary. */
export async function GET(request: NextRequest) {
  const context = await resolveLifecycleContext(request)
  if ('error' in context) return Response.json({ error: context.error }, { status: context.error === 'AUTH_REQUIRED' ? 401 : 503, headers })

  const connectionString = resolvePostgresConnectionString({ DATABASE_URL: process.env.DATABASE_URL, POSTGRES_URL: process.env.POSTGRES_URL })
  if (!connectionString) return Response.json({ error: 'APPLE_DIGITAL_ATOM_DATABASE_REQUIRED' }, { status: 503, headers })

  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000 })
  try {
    const projection = await loadAppleDigitalAtomProjection({
      query: (text, params) => pool.query(text, params),
      now: new Date(),
      maxAgeMs: 24 * 60 * 60 * 1000,
    })
    return Response.json(projection, { status: 200, headers })
  } catch {
    return Response.json({ error: 'APPLE_DIGITAL_ATOM_READ_FAILED' }, { status: 503, headers })
  } finally {
    await pool.end()
  }
}
