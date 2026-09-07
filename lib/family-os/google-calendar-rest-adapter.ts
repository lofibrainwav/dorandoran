import type { NormalizedCalendarEvent } from './contracts.ts'
import {
  normalizeGoogleCalendarEvent,
  type GoogleCalendarNormalizationContext,
} from './google-calendar-adapter.ts'

export interface GoogleCalendarApiEventPayload {
  id?: unknown
  summary?: unknown
  start?: { dateTime?: unknown; date?: unknown } | null
  end?: { dateTime?: unknown; date?: unknown } | null
  location?: unknown
  description?: unknown
  htmlLink?: unknown
  recurringEventId?: unknown
}

function timedValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function normalizeGoogleCalendarApiEvent(
  payload: GoogleCalendarApiEventPayload,
  context: GoogleCalendarNormalizationContext,
): NormalizedCalendarEvent {
  const start = timedValue(payload.start?.dateTime)
  const end = timedValue(payload.end?.dateTime)
  if (!start || !end) throw new Error('INVALID_GOOGLE_CALENDAR_API_EVENT')

  try {
    return normalizeGoogleCalendarEvent({
      id: payload.id,
      summary: payload.summary,
      start,
      end,
      location: payload.location,
      description: payload.description,
      url: payload.htmlLink,
      recurring_event_id: payload.recurringEventId,
    }, context)
  } catch {
    throw new Error('INVALID_GOOGLE_CALENDAR_API_EVENT')
  }
}
