import { readFile } from 'node:fs/promises'
import { google } from 'googleapis'
import {
  decomposeCalendarEvent,
  normalizeGoogleCalendarApiEvent,
} from '../lib/family-os/index.ts'

const clientPath = process.env.GOOGLE_CALENDAR_CLIENT_SECRET_PATH
const tokenPath = process.env.GOOGLE_CALENDAR_TOKEN_PATH
const calendarId = process.env.GOOGLE_CALENDAR_TARGET_ID

if (!clientPath || !tokenPath || !calendarId) {
  throw new Error('GOOGLE_CALENDAR_LOCAL_SMOKE_ENV_MISSING')
}

const rawClient = JSON.parse(await readFile(clientPath, 'utf8'))
const clientMeta = rawClient.installed ?? rawClient.web
const tokenRecord = JSON.parse(await readFile(tokenPath, 'utf8'))

if (!clientMeta?.client_id || !clientMeta?.client_secret) {
  throw new Error('INVALID_GOOGLE_CALENDAR_CLIENT_FILE')
}
if (tokenRecord.clientId !== clientMeta.client_id) {
  throw new Error('GOOGLE_CALENDAR_TOKEN_CLIENT_MISMATCH')
}
const auth = new google.auth.OAuth2(clientMeta.client_id, clientMeta.client_secret)
auth.setCredentials(tokenRecord.credentials)

const calendar = google.calendar({ version: 'v3', auth })
const start = new Date()
start.setHours(0, 0, 0, 0)
start.setDate(start.getDate() - start.getDay())
const end = new Date(start)
end.setDate(end.getDate() + 8)

const response = await calendar.events.list({
  calendarId,
  timeMin: start.toISOString(),
  timeMax: end.toISOString(),
  singleEvents: true,
  orderBy: 'startTime',
  maxResults: 100,
})

const items = response.data.items ?? []
let allDaySkipped = 0
let normalizedCount = 0
let blockCount = 0
let invalidTimedCount = 0
for (const item of items) {
  if (!item.start?.dateTime || !item.end?.dateTime) {
    allDaySkipped += 1
    continue
  }

  try {
    const normalized = normalizeGoogleCalendarApiEvent(item, {
      calendarId,
      observedAt: new Date().toISOString(),
    })
    const blocks = decomposeCalendarEvent(normalized)
    normalizedCount += 1
    blockCount += blocks.length
  } catch {
    invalidTimedCount += 1
  }
}

if (normalizedCount === 0 || blockCount === 0 || invalidTimedCount > 0) {
  throw new Error('GOOGLE_CALENDAR_LIVE_SMOKE_FAILED')
}

console.log('LIVE_READ_OK')
console.log(`EVENT_COUNT=${items.length}`)
console.log(`TIMED_NORMALIZED=${normalizedCount}`)
console.log(`ALL_DAY_SKIPPED=${allDaySkipped}`)
console.log(`FAMILY_BLOCKS=${blockCount}`)
console.log('No event titles, descriptions, locations, or addresses were printed.')
