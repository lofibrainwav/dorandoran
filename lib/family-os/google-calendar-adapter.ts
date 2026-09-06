import type { NormalizedCalendarEvent } from './contracts.ts'

export interface GoogleCalendarEventPayload {
  id?: unknown
  summary?: unknown
  start?: unknown
  end?: unknown
  location?: unknown
  description?: unknown
  url?: unknown
  recurring_event_id?: unknown
}

export interface GoogleCalendarNormalizationContext {
  calendarId: string
  observedAt: string
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function normalizeGoogleCalendarEvent(
  payload: GoogleCalendarEventPayload,
  context: GoogleCalendarNormalizationContext,
): NormalizedCalendarEvent {
  const id = requiredString(payload.id)
  const title = requiredString(payload.summary)
  const start = requiredString(payload.start)
  const end = requiredString(payload.end)
  const calendarId = requiredString(context.calendarId)
  const observedAt = requiredString(context.observedAt)

  if (!id || !title || !start || !end || !calendarId || !observedAt) {
    throw new Error('INVALID_GOOGLE_CALENDAR_EVENT')
  }

  const evidenceId = `calendar:${calendarId}:${id}`
  return {
    id,
    title,
    description: optionalString(payload.description),
    start,
    end,
    location: optionalString(payload.location),
    recurrence: optionalString(payload.recurring_event_id),
    protected: true,
    evidence: [{
      id: evidenceId,
      sourceType: 'calendar',
      sourceId: `${calendarId}:${id}`,
      uri: optionalString(payload.url),
      observedAt,
      state: 'confirmed',
    }],
  }
}
