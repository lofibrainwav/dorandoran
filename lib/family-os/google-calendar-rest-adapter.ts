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

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function normalizeGoogleCalendarApiEvent(
  payload: GoogleCalendarApiEventPayload,
  context: GoogleCalendarNormalizationContext,
): NormalizedCalendarEvent {
  const timedStart = stringValue(payload.start?.dateTime)
  const timedEnd = stringValue(payload.end?.dateTime)
  const dateStart = stringValue(payload.start?.date)
  const dateEnd = stringValue(payload.end?.date)
  const isTimed = Boolean(timedStart && timedEnd)
  const isAllDay = Boolean(dateStart && dateEnd)
  if (!isTimed && !isAllDay) throw new Error('INVALID_GOOGLE_CALENDAR_API_EVENT')

  const start = isTimed ? timedStart : dateStart
  const end = isTimed ? timedEnd : dateEnd

  try {
    const normalized = normalizeGoogleCalendarEvent({
      id: payload.id,
      summary: payload.summary,
      start,
      end,
      location: payload.location,
      description: payload.description,
      url: payload.htmlLink,
      recurring_event_id: payload.recurringEventId,
    }, context)
    return isAllDay ? { ...normalized, allDay: true } : normalized
  } catch {
    throw new Error('INVALID_GOOGLE_CALENDAR_API_EVENT')
  }
}
