import test from 'node:test'
import assert from 'node:assert/strict'
import {
  decomposeCalendarEvent,
  mergeCalendarSourceBlocks,
  normalizeGoogleCalendarEvent,
} from '../../lib/family-os/index.ts'

const payload = {
  id: 'same-provider-id',
  summary: 'Shared-looking event',
  start: '2026-09-08T15:00:00-07:00',
  end: '2026-09-08T16:00:00-07:00',
}

test('same provider event id in different calendars gets distinct canonical FamilyBlock ids', () => {
  const a = decomposeCalendarEvent(normalizeGoogleCalendarEvent(payload, {
    calendarId: 'calendar-a', observedAt: '2026-09-06T12:00:00Z',
  }))
  const b = decomposeCalendarEvent(normalizeGoogleCalendarEvent(payload, {
    calendarId: 'calendar-b', observedAt: '2026-09-06T12:00:00Z',
  }))
  assert.notEqual(a[0].id, b[0].id)
  const merged = mergeCalendarSourceBlocks([a, b])
  assert.equal(merged.length, 2)
  assert.deepEqual(new Set(merged.map((block) => block.id)).size, 2)
})

test('merge never guesses duplicate equivalence from matching titles and times', () => {
  const a = decomposeCalendarEvent(normalizeGoogleCalendarEvent(payload, {
    calendarId: 'calendar-a', observedAt: '2026-09-06T12:00:00Z',
  }))
  const b = decomposeCalendarEvent(normalizeGoogleCalendarEvent(payload, {
    calendarId: 'calendar-b', observedAt: '2026-09-06T12:00:00Z',
  }))
  assert.equal(mergeCalendarSourceBlocks([a, b]).filter((block) => block.type === 'event').length, 2)
})
