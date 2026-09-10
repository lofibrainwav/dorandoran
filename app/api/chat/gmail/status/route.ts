import type { NextRequest } from 'next/server'
import { parseHouseholdMembership } from '../../../../../lib/family-os/google-household-identity.ts'
import { HOUSEHOLD_SESSION_COOKIE, resolveHouseholdSessionMember } from '../../../../../lib/server/google-household-session.ts'
import { gmailWebRuntimeHealth, resolveGoogleGmailWebRuntimeConfig, verifyGoogleGmailWebCapability } from '../../../../../lib/server/google-gmail-web-transport.ts'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

/** Reports Gmail read-surface readiness without reading Inbox metadata. */
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
    if (health === 'off') return Response.json({ status: 'not_connected', readOnly: true }, { headers })
    if (health === 'incomplete') return Response.json({ status: 'incomplete', readOnly: true }, { status: 503, headers })
    const config = resolveGoogleGmailWebRuntimeConfig(process.env)
    if (!config) return Response.json({ status: 'not_connected', readOnly: true }, { headers })
    await verifyGoogleGmailWebCapability(config)
    return Response.json({ status: 'connected', readOnly: true }, { headers })
  } catch {
    return Response.json({ status: 'unavailable', readOnly: true }, { status: 503, headers })
  }
}
