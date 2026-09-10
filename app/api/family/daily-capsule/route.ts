import type { NextRequest } from 'next/server'
import { createFamilyDailyCapsule } from '@/lib/family-os/daily-capsule'
import { buildArtifactRegistry } from '@/lib/family-os/artifact-registry'
import { readDriveOutbox } from '@/lib/server/drive-outbox-read'
import { resolveLifecycleContext } from '@/lib/server/lifecycle-runtime'
import { createPostgresDailyCapsuleStore } from '@/lib/server/daily-capsule-store'
import { resolvePostgresConnectionString } from '@/lib/server/postgres-connection'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }
const EMPTY_ARTIFACT_REGISTRY = { version: 1 as const, artifacts: [], conflicts: [] }

function requestedDate(value: string | null): string | null {
  const date = value?.trim() || new Date().toISOString().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ? date : null
}

function belongsToDate(timestamp: string, date: string): boolean {
  return Number.isFinite(Date.parse(timestamp)) && new Date(timestamp).toISOString().slice(0, 10) === date
}

/** Returns only the privacy-safe daily projection. It never exposes lifecycle text or mutates a source. */
export async function GET(request: NextRequest) {
  const context = await resolveLifecycleContext(request)
  if ('error' in context) {
    return Response.json({ error: context.error }, { status: context.error === 'AUTH_REQUIRED' ? 401 : 503, headers })
  }

  const date = requestedDate(request.nextUrl.searchParams.get('date'))
  if (!date) return Response.json({ error: 'DATE_INVALID' }, { status: 400, headers })

  try {
    const connectionString = resolvePostgresConnectionString({
      DATABASE_URL: process.env.DATABASE_URL,
      POSTGRES_URL: process.env.POSTGRES_URL,
    })
    if (connectionString) {
      const { Pool } = await import('pg')
      const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000 })
      try {
        const sealed = await createPostgresDailyCapsuleStore({ query: (text, params) => pool.query(text, params) }).get({
          householdKey: process.env.DORANDORAN_HOUSEHOLD_KEY?.trim() || 'default',
          date,
        })
        if (sealed) return Response.json({ capsule: sealed.capsule, sources: { lifecycle: 'sealed', artifacts: 'sealed', generatedAt: sealed.generatedAt } }, { status: 200, headers })
      } catch {
        // migration 지연으로 기존 live projection까지 중단시키지 않는다.
      } finally {
        await pool.end()
      }
    }
    const [captures, candidates, tasks, drive] = await Promise.all([
      context.service.listFamilyCaptures(context.viewer, { limit: 500 }),
      context.service.listFamilyCandidates(context.viewer, { limit: 500 }),
      context.service.listFamilyTasks(context.viewer, { limit: 500 }),
      readDriveOutbox({ lane: '10_JAY', capturedBy: `doran-capsule:${context.viewer.personId}`, capturedAt: new Date().toISOString() }),
    ])
    const artifacts = drive.result?.entries.flatMap((entry) => entry.outcome === 'accepted' && entry.intake.artifact && belongsToDate(entry.intake.artifact.observedAt as string, date) ? [entry.intake.artifact] : []) ?? []
    const capsule = createFamilyDailyCapsule({
      date,
      artifactRegistry: artifacts.length ? buildArtifactRegistry(artifacts) : EMPTY_ARTIFACT_REGISTRY,
      captures: captures.filter((capture) => belongsToDate(capture.capturedAt, date)),
      candidates: candidates.filter((candidate) => belongsToDate(candidate.createdAt, date)),
      tasks: tasks.filter((task) => belongsToDate(task.createdAt, date) || belongsToDate(task.updatedAt, date)),
    })
    return Response.json({ capsule, sources: { lifecycle: 'connected', artifacts: drive.status } }, { status: 200, headers })
  } catch {
    return Response.json({ error: 'DAILY_CAPSULE_UNAVAILABLE' }, { status: 503, headers })
  }
}
