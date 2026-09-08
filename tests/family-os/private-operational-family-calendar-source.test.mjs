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
  const personProjection = JSON.stringify({ readModel: result.readModel, observations: result.observations })
  assert.equal(personProjection.includes('Adult appointment'), false)
  assert.equal(personProjection.includes('Unknown event'), false)
  assert.equal(result.householdObservations.length, 3)
  assert.equal(JSON.stringify(result).includes('/private/token.json'), false)
})

test('malformed household facts leave the source unknown, never silently complete or crashing', async () => {
  for (const invalid of [
    { id: 'missing-end', summary: 'Invalid', start: { date: '2026-09-08' } },
    { id: 'invalid-date', summary: 'Invalid', start: { date: '2026-02-30' }, end: { date: '2026-03-02' } },
    { id: 'reversed', summary: 'Invalid', start: { date: '2026-09-09' }, end: { date: '2026-09-08' } },
    { ...payloads[0], start: { dateTime: 'not-a-time' } },
  ]) {
    const result = await loadPrivateOperationalFamilyCalendarPerson({
      env, personId: 'child-a', label: 'Child',
      now: new Date('2026-09-08T16:00:00Z'), timeZone: 'America/Los_Angeles',
      readEvents: async () => [...payloads, invalid],
    })
    assert.equal(result.sourceHealth, 'failure')
    assert.deepEqual(result.householdObservations, [])
    assert.deepEqual(result.observations, [])
    assert.equal(result.readModel.next, 'Unknown')
  }
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

test('household facts keep every calendar event: unresolved subjects become Family, all-day events are kept', async () => {
  const widerPayloads = [
    ...payloads,
    { id: 'event-church', recurringEventId: 'series-church', summary: 'Church',
      start: { dateTime: '2026-09-06T18:00:00-07:00' }, end: { dateTime: '2026-09-06T19:00:00-07:00' } },
    { id: 'event-passport', summary: 'Passport expiry', start: { date: '2026-09-09' }, end: { date: '2026-09-10' } },
  ]
  const result = await loadPrivateOperationalFamilyCalendarPerson({
    env, personId: 'child-a', label: 'Child',
    now: new Date('2026-09-08T16:00:00-07:00'), timeZone: 'America/Los_Angeles',
    readEvents: async () => widerPayloads,
  })
  assert.ok(result)
  // Person-scoped projection is unchanged: only the resolved child event feeds NOW/NEXT.
  assert.equal(result.observations.length, 1)
  // Household facts: child (resolved), adult (resolved to another person), unknown series, unknown single all-day.
  const facts = result.householdObservations
  assert.equal(facts.length, 5)
  const byTitle = Object.fromEntries(facts.map((o) => [o.sixW1H.what?.label, o]))
  assert.deepEqual(byTitle['Child activity'].sixW1H.who?.personIds, ['child-a'])
  assert.deepEqual(byTitle['Adult appointment'].sixW1H.who?.personIds, ['adult-a'])
  assert.deepEqual(byTitle['Church'].sixW1H.who?.personIds, [])
  assert.equal(byTitle['Passport expiry'].kind, 'schedule-all-day')
  assert.equal(byTitle['Passport expiry'].sixW1H.when?.start, '2026-09-09')
  assert.equal(byTitle['Child activity'].kind, 'schedule')
  assert.equal(JSON.stringify(result).includes('/private/token.json'), false)
})
