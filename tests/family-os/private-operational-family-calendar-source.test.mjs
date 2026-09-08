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

test('mixed operational calendar projects only explicitly resolved person events', async () => {
  const result = await loadPrivateOperationalFamilyCalendarPerson({
    env,
    personId: 'child-a',
    label: 'Child',
    now: new Date('2026-09-08T16:00:00-07:00'),
    timeZone: 'America/Los_Angeles',
    readEvents: async () => [
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
    ],
  })

  assert.ok(result)
  assert.equal(result.sourceHealth, 'green')
  assert.equal(result.eventCount, 1)
  assert.equal(result.unassignedEventCount, 1)
  assert.equal(result.readModel.next, 'Child activity')
  assert.equal(JSON.stringify(result).includes('Adult appointment'), false)
  assert.equal(JSON.stringify(result).includes('Unknown event'), false)
  assert.equal(JSON.stringify(result).includes('/private/token.json'), false)
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
