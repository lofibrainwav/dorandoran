import test from 'node:test'
import assert from 'node:assert/strict'
import { decomposeCalendarEvent, normalizeGoogleCalendarApiEvent } from '../../lib/family-os/index.ts'

const context = { calendarId: 'family-calendar', observedAt: '2026-09-06T22:30:00.000Z' }

function apiPayload(overrides = {}) {
  return {
    id: 'api-event-1', summary: 'Practice',
    start: { dateTime: '2026-09-10T18:45:00-07:00' },
    end: { dateTime: '2026-09-10T19:15:00-07:00' },
    location: 'Pool A', description: 'Source text only',
    htmlLink: 'https://calendar.google.com/event?eid=demo', recurringEventId: 'series-1',
    ...overrides,
  }
}

test('raw Google Calendar REST event normalizes through provider boundary', () => {
  const event = normalizeGoogleCalendarApiEvent(apiPayload(), context)
  assert.equal(event.id, 'api-event-1')
  assert.equal(event.start, '2026-09-10T18:45:00-07:00')
  assert.equal(event.end, '2026-09-10T19:15:00-07:00')
  assert.equal(event.recurrence, 'series-1')
  assert.equal(event.evidence[0].state, 'confirmed')
})

test('raw API adapter omits dirty optional fields without leaking description into tasks', () => {
  const event = normalizeGoogleCalendarApiEvent(apiPayload({ location: null }), context)
  assert.equal(event.location, undefined)
  const blocks = decomposeCalendarEvent(event)
  assert.equal(blocks.length, 1)
  assert.deepEqual(blocks[0].childBlockIds, [])
})

test('raw API adapter rejects missing timed start/end truth', () => {
  assert.throws(() => normalizeGoogleCalendarApiEvent(apiPayload({ start: {} }), context), /INVALID_GOOGLE_CALENDAR_API_EVENT/)
  assert.throws(() => normalizeGoogleCalendarApiEvent(apiPayload({ end: null }), context), /INVALID_GOOGLE_CALENDAR_API_EVENT/)
})
