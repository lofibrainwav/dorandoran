import { google } from 'googleapis'
import type { NextRequest } from 'next/server'
import { runDriveOutboxSession } from '@/lib/server/drive-outbox-session'
import { createDriveOutboxPorts, type DriveFilesClient } from '@/lib/server/drive-outbox-ports'
import { createPostgresDriveOutboxCursorStore } from '@/lib/server/drive-outbox-cursor-store'
import { driveOutboxRuntimeHealth, resolveDriveOutboxRuntimeConfig } from '@/lib/server/drive-outbox-runtime'
import { createPostgresDriveHandoffIngestStore } from '@/lib/server/drive-handoff-ingest'
import { resolvePostgresConnectionString } from '@/lib/server/postgres-connection'
import { isCronAuthorized } from '@/lib/server/cron-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const LANES = ['00_DORANDORAN_FAMILY', '10_JAY', '20_SHARED_PROJECTS'] as const
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

function decodeBody(data: unknown): unknown {
  if (typeof data === 'string') return data
  if (Buffer.isBuffer(data)) return data.toString('utf8')
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8')
  return data
}

function count(result: { entries: Array<{ outcome: string }> }, outcome: string): number {
  return result.entries.filter((entry) => entry.outcome === outcome).length
}

/**
 * Vercel nightly trigger. It is deliberately not a household session route: CRON_SECRET is the
 * execution authority, while Drive handoff records can only create Capture/Candidate rows.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized({ authorization: request.headers.get('authorization'), secret: process.env.CRON_SECRET })) {
    return Response.json({ error: 'CRON_UNAUTHORIZED' }, { status: 401, headers })
  }

  const connectionString = resolvePostgresConnectionString({
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
  })
  if (!connectionString) return Response.json({ error: 'RECONCILE_DATABASE_REQUIRED' }, { status: 503, headers })

  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5_000 })
  const now = new Date().toISOString()
  const results: Record<string, unknown>[] = []

  try {
    for (const lane of LANES) {
      const health = driveOutboxRuntimeHealth(process.env, lane)
      if (health === 'off') {
        results.push({ lane, status: 'off' })
        continue
      }
      if (health === 'incomplete') {
        results.push({ lane, status: 'incomplete' })
        continue
      }

      const config = resolveDriveOutboxRuntimeConfig(process.env, lane)
      if (!config) {
        results.push({ lane, status: 'off' })
        continue
      }
      const auth = new google.auth.OAuth2(config.clientId, config.clientSecret)
      auth.setCredentials({ refresh_token: config.refreshToken })
      const drive = google.drive({ version: 'v3', auth })
      const client: DriveFilesClient = {
        list: async (params) => {
          const response = await drive.files.list({
            q: params.q, fields: params.fields, pageSize: params.pageSize,
            ...(params.pageToken ? { pageToken: params.pageToken } : {}),
          })
          return { data: { files: response.data.files as unknown[] | undefined, nextPageToken: response.data.nextPageToken ?? undefined } }
        },
        get: async (params: { fileId: string; alt: 'media' }) => {
          const response = await drive.files.get(params, { responseType: 'text' })
          return { data: decodeBody(response.data) }
        },
        export: async (params: { fileId: string; mimeType: string }) => {
          const response = await drive.files.export(params, { responseType: 'text' })
          return { data: decodeBody(response.data) }
        },
      }
      // The explicit shape is kept at the boundary; the domain layer remains provider-neutral.
      const ports = createDriveOutboxPorts({ client, folderId: config.folderId })
      const ingest = createPostgresDriveHandoffIngestStore({
        query: (text, params) => pool.query(text, params),
        transaction: async (run) => {
          const db = await pool.connect()
          try {
            await db.query('BEGIN')
            const result = await run((text, params) => db.query(text, params))
            await db.query('COMMIT')
            return result
          } catch (error) {
            await db.query('ROLLBACK').catch(() => {})
            throw error
          } finally {
            db.release()
          }
        },
      })
      const result = await runDriveOutboxSession({
        lane,
        store: createPostgresDriveOutboxCursorStore({ query: (text, params) => pool.query(text, params) }),
        ports,
        context: { capturedBy: 'drive-nightly-reconcile', capturedAt: now },
        now,
        onAccepted: (entry) => ingest.ingest({ lane, fileId: entry.fileId, intake: entry.intake, now }).then(() => undefined),
      })
      results.push({ lane, status: 'connected', accepted: count(result, 'accepted'), duplicate: count(result, 'duplicate'), rejected: count(result, 'rejected'), skipped: result.skipped.length, unreadable: result.unreadable.length, cursorAdvanced: result.cursorAdvanced })
    }
    return Response.json({ status: 'ok', observedAt: now, lanes: results }, { status: 200, headers })
  } catch {
    return Response.json({ error: 'RECONCILE_FAILED' }, { status: 503, headers })
  } finally {
    await pool.end()
  }
}
