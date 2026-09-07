import test from 'node:test'
import assert from 'node:assert/strict'
import { loadPrivateCalendarOperatingPerson } from '../../lib/server/private-calendar-operating-source.ts'

const env = {
  GOOGLE_CALENDAR_SOURCE_KEYS: 'child,other',
  GOOGLE_CALENDAR_SOURCE_CHILD_CLIENT_SECRET_PATH: '/private/client.json',
  GOOGLE_CALENDAR_SOURCE_CHILD_TOKEN_PATH: '/private/child-token.json',
  GOOGLE_CALENDAR_SOURCE_CHILD_TARGET_ID: 'child-calendar',
  GOOGLE_CALENDAR_SOURCE_CHILD_SUBJECT_IDS: 'person-1',
  GOOGLE_CALENDAR_SOURCE_OTHER_CLIENT_SECRET_PATH: '/private/client.json',
  GOOGLE_CALENDAR_SOURCE_OTHER_TOKEN_PATH: '/private/other-token.json',
  GOOGLE_CALENDAR_SOURCE_OTHER_TARGET_ID: 'other-calendar',
  GOOGLE_CALENDAR_SOURCE_OTHER_SUBJECT_IDS: 'person-2',
}

const currentEvent = {
  id: 'evt-current', summary: 'School day', description: 'private description must not project',
  start: { dateTime: '2026-09-07T09:00:00-07:00' },
  end: { dateTime: '2026-09-07T14:00:00-07:00' },
  location: 'Scheduled place',
}

const nextEvent = {
  id: 'evt-next', summary: 'Practice',
  start: { dateTime: '2026-09-07T15:00:00-07:00' },
  end: { dateTime: '2026-09-07T16:00:00-07:00' },
}
test('private calendar source projects only explicitly mapped person events', async () => {
  const calls = []
  const result = await loadPrivateCalendarOperatingPerson({
    env,
    personId: 'person-1',
    label: 'Child',
    now: new Date('2026-09-07T12:00:00-07:00'),
    timeZone: 'America/Los_Angeles',
    readEvents: async (config, window) => {
      calls.push({ sourceKey: config.sourceKey, start: window.start.toISOString(), end: window.end.toISOString() })
      return [currentEvent, nextEvent]
    },
  })

  assert.ok(result)
  assert.deepEqual(calls.map((call) => call.sourceKey), ['child'])
  assert.equal(result.sourceHealth, 'green')
  assert.equal(result.readModel.now, 'School day')
  assert.equal(result.readModel.next, 'Practice')
  assert.equal(result.readModel.place.state, 'Scheduled')
  assert.equal(JSON.stringify(result).includes('private description'), false)
  assert.equal(JSON.stringify(result).includes('/private/child-token.json'), false)
})
test('private calendar source reports failure without inventing operating facts', async () => {
  const result = await loadPrivateCalendarOperatingPerson({
    env,
    personId: 'person-1',
    label: 'Child',
    now: new Date('2026-09-07T12:00:00-07:00'),
    timeZone: 'America/Los_Angeles',
    readEvents: async () => { throw new Error('offline') },
  })

  assert.ok(result)
  assert.equal(result.sourceHealth, 'failure')
  assert.equal(result.readModel.now, 'Unknown')
  assert.equal(result.readModel.next, 'Unknown')
  assert.deepEqual(result.failedSourceKeys, ['child'])
})

test('private calendar source returns null when no configured source can map the person', async () => {
  const result = await loadPrivateCalendarOperatingPerson({
    env: {}, personId: 'person-1', label: 'Child',
    now: new Date('2026-09-07T12:00:00-07:00'), timeZone: 'America/Los_Angeles',
    readEvents: async () => [],
  })
  assert.equal(result, null)
})
