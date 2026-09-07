import test from 'node:test'
import assert from 'node:assert/strict'
import { loadPrivateCalendarTemporalGrids } from '../../lib/server/private-calendar-temporal-source.ts'

const env = {
  GOOGLE_CALENDAR_SOURCE_KEYS: 'child,other',
  GOOGLE_CALENDAR_SOURCE_CHILD_CLIENT_SECRET_PATH: '/private/client.json',
  GOOGLE_CALENDAR_SOURCE_CHILD_TOKEN_PATH: '/private/child-token.json',
  GOOGLE_CALENDAR_SOURCE_CHILD_TARGET_ID: 'primary',
  GOOGLE_CALENDAR_SOURCE_CHILD_SUBJECT_IDS: 'person-child',
  GOOGLE_CALENDAR_SOURCE_OTHER_CLIENT_SECRET_PATH: '/private/client.json',
  GOOGLE_CALENDAR_SOURCE_OTHER_TOKEN_PATH: '/private/other-token.json',
  GOOGLE_CALENDAR_SOURCE_OTHER_TARGET_ID: 'other',
  GOOGLE_CALENDAR_SOURCE_OTHER_SUBJECT_IDS: 'person-other',
}

const eventPayload = {
  id: 'event-1', summary: 'Private event',
  start: { dateTime: '2026-09-07T18:00:00-07:00' },
  end: { dateTime: '2026-09-07T19:00:00-07:00' },
}
test('private temporal source reads one LA-local year and feeds Month + Year', async () => {
  const calls = []
  const result = await loadPrivateCalendarTemporalGrids({
    env, personId: 'person-child', now: new Date('2026-09-07T21:00:00Z'),
    timeZone: 'America/Los_Angeles',
    readEvents: async (config, window) => {
      calls.push({ sourceKey: config.sourceKey, start: window.start.toISOString(), end: window.end.toISOString() })
      return [eventPayload]
    },
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].sourceKey, 'child')
  assert.equal(calls[0].start, '2026-01-01T08:00:00.000Z')
  assert.equal(calls[0].end, '2027-01-01T08:00:00.000Z')
  assert.equal(result.sourceHealth, 'green')
  assert.equal(result.monthGrid.cells.find((cell) => cell.dateKey === '2026-09-07').observationCount, 1)
  assert.equal(result.yearGrid.cells.find((cell) => cell.monthKey === '2026-09').observationCount, 1)
})
test('private temporal display contains no calendar evidence refs', async () => {
  const result = await loadPrivateCalendarTemporalGrids({
    env, personId: 'person-child', now: new Date('2026-09-07T21:00:00Z'),
    timeZone: 'America/Los_Angeles', readEvents: async () => [eventPayload],
  })
  const json = JSON.stringify(result)
  assert.equal(json.includes('calendar:'), false)
  assert.equal(json.includes('Private event'), false)
  assert.equal(json.includes('/private/'), false)
})

test('private temporal source returns null when no source maps the person', async () => {
  const result = await loadPrivateCalendarTemporalGrids({
    env, personId: 'person-missing', now: new Date('2026-09-07T21:00:00Z'),
    timeZone: 'America/Los_Angeles', readEvents: async () => [eventPayload],
  })
  assert.equal(result, null)
})

test('private temporal source reports read failure without invented counts', async () => {
  const result = await loadPrivateCalendarTemporalGrids({
    env, personId: 'person-child', now: new Date('2026-09-07T21:00:00Z'),
    timeZone: 'America/Los_Angeles', readEvents: async () => { throw new Error('read failed') },
  })
  assert.equal(result.sourceHealth, 'failure')
  assert.equal(result.eventCount, 0)
  assert.equal(result.yearGrid.cells.every((cell) => cell.observationCount === 0), true)
})
