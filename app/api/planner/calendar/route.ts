import type { NextRequest } from 'next/server'
import { assertSameOrigin, resolveLifecycleContext } from '@/lib/server/lifecycle-runtime'
import { resolveGoogleCalendarWebRuntimeConfig, writeGoogleCalendarWebEvent, type GoogleCalendarTimeboxInput } from '@/lib/server/google-calendar-web-transport'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

function parseTimebox(value: unknown): GoogleCalendarTimeboxInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (Object.values(input).some((item) => item === undefined)) return null
  if (typeof input.id !== 'string' || typeof input.title !== 'string' || typeof input.date !== 'string' || typeof input.owner !== 'string' || typeof input.timeZone !== 'string') return null
  if (typeof input.startMinute !== 'number' || typeof input.minutes !== 'number') return null
  return { id: input.id, title: input.title, date: input.date, startMinute: input.startMinute, minutes: input.minutes, owner: input.owner, timeZone: input.timeZone }
}

/** Adds one user-approved Planner timebox to the configured family Calendar. */
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return Response.json({ error: 'ORIGIN_DENIED' }, { status: 403, headers })
  const context = await resolveLifecycleContext(request)
  if ('error' in context) return Response.json({ error: context.error }, { status: context.error === 'AUTH_REQUIRED' ? 401 : 503, headers })
  if (context.viewer.access !== 'adult' || (!context.viewer.roles.includes('admin') && !context.viewer.roles.includes('scheduler'))) {
    return Response.json({ error: 'CALENDAR_WRITE_NOT_ALLOWED' }, { status: 403, headers })
  }
  let body: unknown
  try { body = await request.json() } catch { return Response.json({ error: 'BODY_INVALID' }, { status: 400, headers }) }
  const input = parseTimebox(body)
  if (!input) return Response.json({ error: 'BODY_INVALID' }, { status: 400, headers })
  try {
    const config = resolveGoogleCalendarWebRuntimeConfig(process.env)
    if (!config) return Response.json({ error: 'CALENDAR_WRITE_UNCONFIGURED' }, { status: 503, headers })
    const result = await writeGoogleCalendarWebEvent(config, input)
    return Response.json(result, { status: result.created ? 201 : 200, headers })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'CALENDAR_WRITE_FAILED'
    const safeCode = code.startsWith('INVALID_') ? code : 'CALENDAR_WRITE_FAILED'
    return Response.json({ error: safeCode }, { status: safeCode.startsWith('INVALID_') ? 400 : 502, headers })
  }
}
