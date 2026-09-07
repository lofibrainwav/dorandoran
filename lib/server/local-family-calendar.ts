import { readFile } from 'node:fs/promises'
import { google } from 'googleapis'
import type { FamilyBlock } from '@/lib/family-os/contracts'
import {
  decomposeCalendarEvent,
  normalizeGoogleCalendarApiEvent,
  resolveLocalCalendarRuntimeConfig,
  weekWindowFromLocalDate,
} from '@/lib/family-os'

export interface LocalFamilyWeekResult {
  source: 'live-local'
  blocks: FamilyBlock[]
  weekStartDate: string
  eventCount: number
}

export async function loadLocalFamilyWeek(
  env: Record<string, string | undefined> = process.env,
): Promise<LocalFamilyWeekResult | null> {
  const config = resolveLocalCalendarRuntimeConfig(env)
  if (!config) return null
  const rawClient = JSON.parse(await readFile(config.clientPath, 'utf8'))
  const clientMeta = rawClient.installed ?? rawClient.web
  const tokenRecord = JSON.parse(await readFile(config.tokenPath, 'utf8'))

  if (!clientMeta?.client_id || !clientMeta?.client_secret) {
    throw new Error('INVALID_GOOGLE_CALENDAR_CLIENT_FILE')
  }
  if (tokenRecord.clientId !== clientMeta.client_id) {
    throw new Error('GOOGLE_CALENDAR_TOKEN_CLIENT_MISMATCH')
  }

  const auth = new google.auth.OAuth2(clientMeta.client_id, clientMeta.client_secret)
  auth.setCredentials(tokenRecord.credentials)
  const calendar = google.calendar({ version: 'v3', auth })
  const window = weekWindowFromLocalDate(new Date())

  const response = await calendar.events.list({
    calendarId: config.calendarId,
    timeMin: window.start.toISOString(),
    timeMax: window.end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  })
  const observedAt = new Date().toISOString()
  const blocks: FamilyBlock[] = []
  let timedEventCount = 0

  for (const item of response.data.items ?? []) {
    if (!item.start?.dateTime || !item.end?.dateTime) continue
    const normalized = normalizeGoogleCalendarApiEvent(item, {
      calendarId: config.calendarId,
      observedAt,
    })
    blocks.push(...decomposeCalendarEvent(normalized))
    timedEventCount += 1
  }

  return {
    source: 'live-local',
    blocks,
    weekStartDate: window.weekStartDate,
    eventCount: timedEventCount,
  }
}
