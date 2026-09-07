import test from 'node:test'
import assert from 'node:assert/strict'
import { decomposeCalendarEvent, normalizeGoogleCalendarEvent } from '../../lib/family-os/index.ts'

const context = { calendarId: 'family-calendar', observedAt: '2026-09-06T22:00:00.000Z' }

function payload(overrides = {}) {
  return {
    id: 'evt-google-1', summary: 'Music lesson',
    start: '2026-09-08T15:45:00-07:00', end: '2026-09-08T16:15:00-07:00',
    location: 'Studio A', description: 'Bring folder',
    url: 'https://calendar.example/event/1', recurring_event_id: 'series-1',
    ...overrides,
  }
}

test('Google Calendar payload normalizes into protected provider-neutral event', () => {
  const event = normalizeGoogleCalendarEvent(payload(), context)
  assert.equal(event.id, 'evt-google-1')
  assert.equal(event.title, 'Music lesson')
  assert.equal(event.location, 'Studio A')
  assert.equal(event.recurrence, 'series-1')
  assert.equal(event.protected, true)
  assert.equal(event.evidence[0].sourceType, 'calendar')
  assert.equal(event.evidence[0].state, 'confirmed')
})

test('missing optional location is omitted without changing confirmed source state', () => {
  const event = normalizeGoogleCalendarEvent(payload({ location: null }), context)
  assert.equal(event.location, undefined)
  assert.equal(event.evidence[0].state, 'confirmed')
})

test('malformed required Google event fields fail clearly', () => {
  assert.throws(() => normalizeGoogleCalendarEvent(payload({ id: '' }), context), /INVALID_GOOGLE_CALENDAR_EVENT/)
  assert.throws(() => normalizeGoogleCalendarEvent(payload({ start: null }), context), /INVALID_GOOGLE_CALENDAR_EVENT/)
})

test('normalized Google event composes with deterministic decomposition without reading description', () => {
  const event = normalizeGoogleCalendarEvent(payload(), context)
  const blocks = decomposeCalendarEvent(event)
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].reality.title, 'Music lesson')
  assert.deepEqual(blocks[0].childBlockIds, [])
})
