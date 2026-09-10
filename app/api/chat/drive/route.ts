import type { NextRequest } from 'next/server'
import { parseHouseholdMembership } from '@/lib/family-os/google-household-identity'
import { projectDriveArtifacts } from '@/lib/family-os/drive-artifact-projection'
import { readDriveOutbox } from '@/lib/server/drive-outbox-read'
import { HOUSEHOLD_SESSION_COOKIE, resolveHouseholdSessionMember } from '@/lib/server/google-household-session'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }
const DEFAULT_LANE = '10_JAY'
const ALLOWED_LANES = new Set(['00_DORANDORAN_FAMILY', '10_JAY', '20_SHARED_PROJECTS'])

/** Read-only Drive projection for Doran Chat. It never advances the outbox cursor. */
export async function GET(request: NextRequest) {
  try {
    const membership = parseHouseholdMembership(process.env)
    const member = await resolveHouseholdSessionMember(
      request.cookies.get(HOUSEHOLD_SESSION_COOKIE)?.value,
      process.env.DORANDORAN_AUTH_SECRET ?? '',
      membership,
      Date.now(),
    )
    if (!member) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401, headers })

    const requestedLane = request.nextUrl.searchParams.get('lane')?.trim() || DEFAULT_LANE
    if (!ALLOWED_LANES.has(requestedLane)) {
      return Response.json({ error: 'DRIVE_OUTBOX_LANE_NOT_ALLOWED' }, { status: 400, headers })
    }

    const read = await readDriveOutbox({ lane: requestedLane, capturedBy: `doran-chat:${member.personId}`, capturedAt: new Date().toISOString() })
    if (read.status !== 'connected' || !read.result) {
      return Response.json({ status: read.status, lane: requestedLane, artifacts: [] }, { status: read.status === 'unavailable' || read.status === 'incomplete' ? 503 : 200, headers })
    }
    return Response.json({ status: 'connected', lane: requestedLane, ...projectDriveArtifacts(read.result) }, { headers })
  } catch {
    return Response.json({ status: 'unavailable', artifacts: [] }, { status: 503, headers })
  }
}
