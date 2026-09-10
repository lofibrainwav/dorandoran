import type { NextRequest } from 'next/server'
import { parseHouseholdDisplayNames, parseHouseholdMembership, resolveHouseholdTimeZone, resolveUniqueChildPersonId } from '@/lib/family-os'
import { buildFamilyPlanner } from '@/lib/family-os/family-planner'
import { HOUSEHOLD_SESSION_COOKIE, resolveHouseholdSessionMember } from '@/lib/server/google-household-session'
import { loadPrivateOperationalFamilyCalendarPerson } from '@/lib/server/private-operational-family-calendar-source'
import { loadPrivateCalendarOperatingPerson } from '@/lib/server/private-calendar-operating-source'
import { privateFamilySurfaceEnabled } from '@/lib/server/private-family-surface'
import { selectScheduleResult } from '@/lib/server/schedule-result-selection'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

function childLabel(membership: ReturnType<typeof parseHouseholdMembership>, childPersonId: string): string {
  let configured: Record<string, string> = {}
  try { configured = parseHouseholdDisplayNames(process.env) } catch { /* membership label remains the safe fallback */ }
  const member = membership.find((item) => item.personId === childPersonId)
  return configured[childPersonId] ?? member?.displayName ?? childPersonId
}

/** Recheck calendar facts before planning; never mutates an external calendar. */
export async function GET(request: NextRequest) {
  try {
    const membership = parseHouseholdMembership(process.env)
    const member = await resolveHouseholdSessionMember(request.cookies.get(HOUSEHOLD_SESSION_COOKIE)?.value,
      process.env.DORANDORAN_AUTH_SECRET ?? '', membership, Date.now())
    if (!member) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401, headers })
    const now = new Date()
    const timeZone = resolveHouseholdTimeZone(process.env)
    const childPersonId = resolveUniqueChildPersonId(membership)
    const privateEnabled = privateFamilySurfaceEnabled()
    const modules = [{ id: 'schedule', label: 'Schedule' }]
    const label = childPersonId ? childLabel(membership, childPersonId) : null
    const [operational, local] = await Promise.all([
      childPersonId ? loadPrivateOperationalFamilyCalendarPerson({ personId: childPersonId, label: label!, now, timeZone, modules }) : null,
      privateEnabled && childPersonId ? loadPrivateCalendarOperatingPerson({ personId: childPersonId, label: label!, now, timeZone, modules }) : null,
    ])
    const schedule = selectScheduleResult(operational, local)
    const model = buildFamilyPlanner({ observations: schedule?.householdObservations ?? [], now, timeZone,
      known: schedule?.sourceHealth === 'green', childPersonId })
    return Response.json(model, { headers })
  } catch {
    return Response.json({ error: 'CALENDAR_UNAVAILABLE' }, { status: 503, headers })
  }
}
