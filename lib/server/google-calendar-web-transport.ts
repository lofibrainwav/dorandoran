import { google } from 'googleapis'
import type { GoogleCalendarApiEventPayload } from '../family-os/google-calendar-rest-adapter.ts'
import { assertGoogleCalendarPageComplete, type GoogleCalendarReadWindow } from './google-calendar-local-transport.ts'

export interface GoogleCalendarWebRuntimeConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
  calendarId: string
}

export interface GoogleCalendarTimeboxInput {
  id: string
  title: string
  date: string
  startMinute: number
  minutes: number
  owner: string
  timeZone: string
}

export type GoogleCalendarWriteResult = {
  created: boolean
  event: GoogleCalendarApiEventPayload
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

function assertTimebox(input: GoogleCalendarTimeboxInput): void {
  if (!/^[A-Za-z0-9:_-]{1,200}$/.test(input.id)) throw new Error('INVALID_CALENDAR_TIMEBOX_ID')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('INVALID_CALENDAR_TIMEBOX_DATE')
  if (!Number.isInteger(input.startMinute) || input.startMinute < 0 || input.startMinute >= 1440) {
    throw new Error('INVALID_CALENDAR_TIMEBOX_START')
  }
  if (!Number.isInteger(input.minutes) || input.minutes <= 0 || input.startMinute + input.minutes > 1440) {
    throw new Error('INVALID_CALENDAR_TIMEBOX_DURATION')
  }
  if (!/^[A-Za-z0-9_+/-]+$/.test(input.timeZone)) throw new Error('INVALID_TIME_ZONE')
  if (!input.title.trim() || input.title.length > 200 || !input.owner.trim() || input.owner.length > 100) {
    throw new Error('INVALID_CALENDAR_TIMEBOX_TEXT')
  }
}

function localDateTime(date: string, minute: number): string {
  const day = date.replaceAll('-', '')
  const clock = `${String(Math.floor(minute / 60)).padStart(2, '0')}${String(minute % 60).padStart(2, '0')}`
  return `${day}T${clock}00`
}

export function buildGoogleCalendarEvent(input: GoogleCalendarTimeboxInput) {
  assertTimebox(input)
  return {
    summary: input.title.trim(),
    description: `${input.owner.trim()} · Family OS에서 승인한 계획`,
    start: { dateTime: localDateTime(input.date, input.startMinute), timeZone: input.timeZone },
    end: { dateTime: localDateTime(input.date, input.startMinute + input.minutes), timeZone: input.timeZone },
    extendedProperties: { private: { dorandoranPlanId: input.id } },
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

export async function writeGoogleCalendarWebEvent(
  config: GoogleCalendarWebRuntimeConfig,
  input: GoogleCalendarTimeboxInput,
): Promise<GoogleCalendarWriteResult> {
  const requestBody = buildGoogleCalendarEvent(input)
  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret)
  auth.setCredentials({ refresh_token: config.refreshToken })
  const calendar = google.calendar({ version: 'v3', auth })
  const existing = await calendar.events.list({
    calendarId: config.calendarId,
    privateExtendedProperty: [`dorandoranPlanId=${input.id}`],
    maxResults: 1,
    singleEvents: false,
  })
  const found = existing.data.items?.[0]
  if (found) return { created: false, event: apiPayload(found) }
  const response = await calendar.events.insert({ calendarId: config.calendarId, requestBody })
  return { created: true, event: apiPayload(response.data) }
}
