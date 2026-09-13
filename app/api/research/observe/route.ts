import type { NextRequest } from 'next/server'
import { parseHouseholdMembership } from '@/lib/family-os/google-household-identity'
import { readOpenCliWeb } from '@/lib/server/opencli-research-ports'
import { HOUSEHOLD_SESSION_COOKIE, resolveHouseholdSessionMember } from '@/lib/server/google-household-session'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

/** Read-only web observation for Research Inbox. It never persists, approves, or executes an action. */
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

    const url = request.nextUrl.searchParams.get('url')?.trim() ?? ''
    if (!url) return Response.json({ error: 'RESEARCH_URL_REQUIRED' }, { status: 400, headers })

    let result
    try {
      result = await readOpenCliWeb({
        url,
        observedAt: new Date().toISOString(),
        observer: `Chad · OpenCLI · ${member.personId}`,
      })
    } catch {
      return Response.json({ error: 'RESEARCH_URL_INVALID' }, { status: 400, headers })
    }

    if (result.state === 'unavailable') {
      return Response.json({ state: result.state, reason: result.reason }, { status: 503, headers })
    }
    return Response.json(result, { status: 200, headers })
  } catch {
    return Response.json({ error: 'RESEARCH_UNAVAILABLE' }, { status: 503, headers })
  }
}
