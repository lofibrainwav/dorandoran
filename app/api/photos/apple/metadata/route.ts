import type { NextRequest } from 'next/server'
import { assertSameOrigin, resolveLifecycleContext } from '@/lib/server/lifecycle-runtime'
import { createPostgresApplePhotoStreamStore } from '@/lib/server/apple-photo-stream-store'
import { resolvePostgresConnectionString } from '@/lib/server/postgres-connection'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

/** Accepts only PhotoKit metadata deltas from an authenticated family session. */
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return Response.json({ error: 'ORIGIN_DENIED' }, { status: 403, headers })
  const context = await resolveLifecycleContext(request)
  if ('error' in context) return Response.json({ error: context.error }, { status: context.error === 'AUTH_REQUIRED' ? 401 : 503, headers })

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
