import type { NextRequest } from 'next/server'
import { createFamilyDailyCapsule } from '@/lib/family-os/daily-capsule'
import { resolveLifecycleContext } from '@/lib/server/lifecycle-runtime'

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
    const [captures, candidates, tasks] = await Promise.all([
      context.service.listFamilyCaptures(context.viewer, { limit: 500 }),
      context.service.listFamilyCandidates(context.viewer, { limit: 500 }),
      context.service.listFamilyTasks(context.viewer, { limit: 500 }),
    ])
    const capsule = createFamilyDailyCapsule({
      date,
      artifactRegistry: EMPTY_ARTIFACT_REGISTRY,
      captures: captures.filter((capture) => belongsToDate(capture.capturedAt, date)),
      candidates: candidates.filter((candidate) => belongsToDate(candidate.createdAt, date)),
      tasks: tasks.filter((task) => belongsToDate(task.createdAt, date) || belongsToDate(task.updatedAt, date)),
    })
    return Response.json({ capsule, sources: { lifecycle: 'connected', artifacts: 'not_connected' } }, { status: 200, headers })
  } catch {
    return Response.json({ error: 'DAILY_CAPSULE_UNAVAILABLE' }, { status: 503, headers })
  }
}
