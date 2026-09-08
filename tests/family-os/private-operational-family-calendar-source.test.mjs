import test from 'node:test'
import assert from 'node:assert/strict'

import { loadPrivateOperationalFamilyCalendarPerson } from '../../lib/server/private-operational-family-calendar-source.ts'

const env = {
  GOOGLE_CALENDAR_CLIENT_SECRET_PATH: '/private/client.json',
  GOOGLE_CALENDAR_TOKEN_PATH: '/private/token.json',
  DORANDORAN_FAMILY_CALENDAR_ID: 'opaque-family-operations-calendar',
  DORANDORAN_CALENDAR_SUBJECT_RULES_JSON: JSON.stringify([
    { kind: 'series', sourceId: 'series-child', personId: 'child-a' },
    { kind: 'series', sourceId: 'series-adult', personId: 'adult-a' },
  ]),
}

const payloads = [
  {
    id: 'event-child', recurringEventId: 'series-child', summary: 'Child activity',
    start: { dateTime: '2026-09-08T17:00:00-07:00' },
    end: { dateTime: '2026-09-08T18:00:00-07:00' },
  },
  {
    id: 'event-adult', recurringEventId: 'series-adult', summary: 'Adult appointment',
    start: { dateTime: '2026-09-08T18:30:00-07:00' },
    end: { dateTime: '2026-09-08T19:30:00-07:00' },
  },
  {
    id: 'event-unknown', recurringEventId: 'series-unknown', summary: 'Unknown event',
    start: { dateTime: '2026-09-08T20:00:00-07:00' },
    end: { dateTime: '2026-09-08T21:00:00-07:00' },
  },
]

test('mixed operational calendar projects only explicitly resolved person events', async () => {
  const result = await loadPrivateOperationalFamilyCalendarPerson({
    env,
    personId: 'child-a',
    label: 'Child',
    now: new Date('2026-09-08T16:00:00-07:00'),
    timeZone: 'America/Los_Angeles',
    readEvents: async () => payloads,
  })

  assert.ok(result)
  assert.equal(result.source, 'operational-family-local')
  assert.equal(result.sourceHealth, 'green')
  assert.equal(result.eventCount, 1)
  assert.equal(result.unassignedEventCount, 1)
  assert.equal(result.readModel.next, 'Child activity')
  assert.equal(JSON.stringify(result).includes('Adult appointment'), false)
  assert.equal(JSON.stringify(result).includes('Unknown event'), false)
  assert.equal(JSON.stringify(result).includes('/private/token.json'), false)
})

test('Vercel-safe web Calendar transport is preferred when complete server OAuth credentials exist', async () => {
  const webEnv = {
    ...env,
    GOOGLE_HOUSEHOLD_CALENDAR_CLIENT_ID: 'web-client',
    GOOGLE_HOUSEHOLD_CALENDAR_CLIENT_SECRET: 'web-secret',
    GOOGLE_HOUSEHOLD_CALENDAR_REFRESH_TOKEN: 'web-refresh',
  }
  let localCalled = false
  let webCalled = false
  const result = await loadPrivateOperationalFamilyCalendarPerson({
    env: webEnv,
    personId: 'child-a',
    label: 'Child',
    now: new Date('2026-09-08T16:00:00-07:00'),
    timeZone: 'America/Los_Angeles',
    readEvents: async () => { localCalled = true; return [] },
    readWebEvents: async (config) => {
      webCalled = true
      assert.equal(config.calendarId, 'opaque-family-operations-calendar')
      return payloads
    },
  })

  assert.ok(result)
  assert.equal(result.source, 'operational-family-web')
  assert.equal(result.sourceHealth, 'green')
  assert.equal(result.eventCount, 1)
  assert.equal(webCalled, true)
  assert.equal(localCalled, false)
  assert.equal(JSON.stringify(result).includes('web-refresh'), false)
  assert.equal(JSON.stringify(result).includes('web-secret'), false)
})

test('partial web Calendar credentials fail closed instead of silently falling back to local token files', async () => {
  let localCalled = false
  const result = await loadPrivateOperationalFamilyCalendarPerson({
    env: { ...env, GOOGLE_HOUSEHOLD_CALENDAR_CLIENT_ID: 'partial-client' },
    personId: 'child-a',
    label: 'Child',
    now: new Date('2026-09-08T16:00:00-07:00'),
    timeZone: 'America/Los_Angeles',
    readEvents: async () => { localCalled = true; return payloads },
  })

  assert.ok(result)
  assert.equal(result.source, 'operational-family-web')
  assert.equal(result.sourceHealth, 'failure')
  assert.equal(result.eventCount, 0)
  assert.equal(localCalled, false)
})

test('operational calendar read failure produces no invented schedule facts', async () => {
  const result = await loadPrivateOperationalFamilyCalendarPerson({
    env,
    personId: 'child-a',
    label: 'Child',
    now: new Date('2026-09-08T16:00:00-07:00'),
    timeZone: 'America/Los_Angeles',
    readEvents: async () => { throw new Error('offline') },
  })

  assert.ok(result)
  assert.equal(result.sourceHealth, 'failure')
  assert.equal(result.eventCount, 0)
  assert.equal(result.readModel.now, 'Unknown')
  assert.equal(result.readModel.next, 'Unknown')
})

test('operational family calendar source stays off when required private runtime configuration is absent', async () => {
  const result = await loadPrivateOperationalFamilyCalendarPerson({
    env: {},
    personId: 'child-a',
    label: 'Child',
    now: new Date('2026-09-08T16:00:00-07:00'),
    timeZone: 'America/Los_Angeles',
    readEvents: async () => [],
  })
  assert.equal(result, null)
})

test('operational calendar result exposes the person observations for week rendering', async () => {
  const result = await loadPrivateOperationalFamilyCalendarPerson({
    env,
    personId: 'child-a',
    label: 'Child',
    now: new Date('2026-09-08T16:00:00-07:00'),
    timeZone: 'America/Los_Angeles',
    readEvents: async () => payloads,
  })
  assert.ok(result)
  assert.equal(result.observations.length, 1)
  assert.equal(result.observations[0].sixW1H.what?.label, 'Child activity')
})
