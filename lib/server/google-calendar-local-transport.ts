import { readFile } from 'node:fs/promises'
import { google } from 'googleapis'
import type { GoogleCalendarApiEventPayload } from '../family-os/google-calendar-rest-adapter.ts'
import type { LocalCalendarSourceConfig, LocalWeekWindow } from '../family-os/live-family-week-source.ts'

type ClientMeta = { client_id?: string; client_secret?: string }
type ClientFile = { installed?: ClientMeta; web?: ClientMeta }
type TokenCredentials = {
  access_token?: string | null
  refresh_token?: string | null
  scope?: string
  token_type?: string | null
  expiry_date?: number | null
}
type TokenRecord = { clientId?: string; credentials?: TokenCredentials }

function apiPayload(item: {
  id?: string | null; summary?: string | null; location?: string | null; description?: string | null
  htmlLink?: string | null; recurringEventId?: string | null
  start?: { dateTime?: string | null; date?: string | null } | null
  end?: { dateTime?: string | null; date?: string | null } | null
}): GoogleCalendarApiEventPayload {
  return {
    id: item.id, summary: item.summary, location: item.location, description: item.description,
    htmlLink: item.htmlLink, recurringEventId: item.recurringEventId,
    start: item.start ? { dateTime: item.start.dateTime, date: item.start.date } : undefined,
    end: item.end ? { dateTime: item.end.dateTime, date: item.end.date } : undefined,
  }
}
export async function readGoogleCalendarSource(
  config: LocalCalendarSourceConfig,
  window: LocalWeekWindow,
): Promise<GoogleCalendarApiEventPayload[]> {
  const rawClient = JSON.parse(await readFile(config.clientPath, 'utf8')) as ClientFile
  const tokenRecord = JSON.parse(await readFile(config.tokenPath, 'utf8')) as TokenRecord
  const clientMeta = rawClient.installed ?? rawClient.web
  if (!clientMeta?.client_id || !clientMeta.client_secret) throw new Error('INVALID_GOOGLE_CALENDAR_CLIENT_FILE')
  if (tokenRecord.clientId !== clientMeta.client_id) throw new Error('GOOGLE_CALENDAR_TOKEN_CLIENT_MISMATCH')

  const auth = new google.auth.OAuth2(clientMeta.client_id, clientMeta.client_secret)
  auth.setCredentials(tokenRecord.credentials ?? {})
  const calendar = google.calendar({ version: 'v3', auth })
  const response = await calendar.events.list({
    calendarId: config.calendarId,
    timeMin: window.start.toISOString(),
    timeMax: window.end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  })

  return (response.data.items ?? []).map(apiPayload)
}
