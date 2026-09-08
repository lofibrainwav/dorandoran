import { google } from 'googleapis'
import type { GoogleCalendarApiEventPayload } from '../family-os/google-calendar-rest-adapter.ts'
import { assertGoogleCalendarPageComplete, type GoogleCalendarReadWindow } from './google-calendar-local-transport.ts'

export interface GoogleCalendarWebRuntimeConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
  calendarId: string
}

export type GoogleCalendarWebRuntimeHealth = 'off' | 'incomplete' | 'ready'

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function rawGoogleCalendarWebValues(env: Record<string, string | undefined>) {
  return {
    clientId: clean(env.GOOGLE_HOUSEHOLD_CALENDAR_CLIENT_ID),
    clientSecret: clean(env.GOOGLE_HOUSEHOLD_CALENDAR_CLIENT_SECRET),
    refreshToken: clean(env.GOOGLE_HOUSEHOLD_CALENDAR_REFRESH_TOKEN),
    calendarId: clean(env.DORANDORAN_FAMILY_CALENDAR_ID),
  }
}

export function calendarWebRuntimeHealth(
  env: Record<string, string | undefined>,
): GoogleCalendarWebRuntimeHealth {
  const values = rawGoogleCalendarWebValues(env)
  const credentialInputs = [values.clientId, values.clientSecret, values.refreshToken]
  const anyCredential = credentialInputs.some(Boolean)
  if (!anyCredential) return 'off'
  return credentialInputs.every(Boolean) && Boolean(values.calendarId) ? 'ready' : 'incomplete'
}

export function resolveGoogleCalendarWebRuntimeConfig(
  env: Record<string, string | undefined>,
): GoogleCalendarWebRuntimeConfig | null {
  const health = calendarWebRuntimeHealth(env)
  if (health === 'off') return null
  if (health === 'incomplete') throw new Error('INCOMPLETE_GOOGLE_CALENDAR_WEB_CONFIG')

  const values = rawGoogleCalendarWebValues(env)
  return {
    clientId: values.clientId!,
    clientSecret: values.clientSecret!,
    refreshToken: values.refreshToken!,
    calendarId: values.calendarId!,
  }
}

function apiPayload(item: {
  id?: string | null
  summary?: string | null
  location?: string | null
  description?: string | null
  htmlLink?: string | null
  recurringEventId?: string | null
  start?: { dateTime?: string | null; date?: string | null } | null
  end?: { dateTime?: string | null; date?: string | null } | null
}): GoogleCalendarApiEventPayload {
  return {
    id: item.id,
    summary: item.summary,
    location: item.location,
    description: item.description,
    htmlLink: item.htmlLink,
    recurringEventId: item.recurringEventId,
    start: item.start ? { dateTime: item.start.dateTime, date: item.start.date } : undefined,
    end: item.end ? { dateTime: item.end.dateTime, date: item.end.date } : undefined,
  }
}

export async function readGoogleCalendarWebSource(
  config: GoogleCalendarWebRuntimeConfig,
  window: GoogleCalendarReadWindow,
): Promise<GoogleCalendarApiEventPayload[]> {
  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret)
  auth.setCredentials({ refresh_token: config.refreshToken })
  const calendar = google.calendar({ version: 'v3', auth })
  const response = await calendar.events.list({
    calendarId: config.calendarId,
    timeMin: window.start.toISOString(),
    timeMax: window.end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 2500,
  })

  assertGoogleCalendarPageComplete(response.data.nextPageToken)
  return (response.data.items ?? []).map(apiPayload)
}
