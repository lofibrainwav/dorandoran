import type { NextRequest } from 'next/server'
import { parseHouseholdMembership } from '@/lib/family-os/google-household-identity'
import { planBoundedGmailRead } from '@/lib/family-os/gmail-live-policy'
import { HOUSEHOLD_SESSION_COOKIE, resolveHouseholdSessionMember } from '@/lib/server/google-household-session'
import { gmailWebRuntimeHealth, readGoogleGmailWebSource, resolveGoogleGmailWebRuntimeConfig } from '@/lib/server/google-gmail-web-transport'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

/** Read-only, bounded Gmail status for Doran Chat. Never sends mail or creates drafts. */
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

    const health = gmailWebRuntimeHealth(process.env)
    if (health === 'off') return Response.json({ status: 'not_connected', messages: [] }, { headers })
    if (health === 'incomplete') return Response.json({ status: 'incomplete', messages: [] }, { status: 503, headers })
    const config = resolveGoogleGmailWebRuntimeConfig(process.env)
    if (!config) return Response.json({ status: 'not_connected', messages: [] }, { headers })

    const plan = planBoundedGmailRead({ query: 'newer_than:7d label:inbox', maxResults: 20 })
    const messages = await readGoogleGmailWebSource(config, plan)
    return Response.json({ status: 'connected', query: plan.query, messages }, { headers })
  } catch {
    return Response.json({ status: 'unavailable', messages: [] }, { status: 503, headers })
  }
}
