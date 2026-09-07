import test from 'node:test'
import assert from 'node:assert/strict'
import {
  decomposeCalendarEvent,
  normalizeGoogleCalendarApiEvent,
  projectAllDayWeekBlocks,
} from '../../lib/family-os/index.ts'

const context = { calendarId: 'school-calendar', observedAt: '2026-09-06T12:00:00.000Z' }

function allDayPayload(overrides = {}) {
  return {
    id: 'all-day-1',
    summary: 'School closure',
    start: { date: '2026-09-07' },
    end: { date: '2026-09-08' },
    ...overrides,
  }
}
test('Google REST all-day event preserves date truth and exclusive end', () => {
  const event = normalizeGoogleCalendarApiEvent(allDayPayload(), context)
  assert.equal(event.allDay, true)
  assert.equal(event.start, '2026-09-07')
  assert.equal(event.end, '2026-09-08')

  const [block] = decomposeCalendarEvent(event)
  assert.equal(block.reality.allDay, true)
})

test('all-day week projection maps exclusive end to occupied day span', () => {
  const event = normalizeGoogleCalendarApiEvent(allDayPayload({
    start: { date: '2026-09-11' },
    end: { date: '2026-09-13' },
  }), context)
  const [block] = decomposeCalendarEvent(event)
  assert.deepEqual(projectAllDayWeekBlocks([block], '2026-09-06'), [
    { blockId: block.id, startDayIndex: 5, endDayIndexExclusive: 7 },
  ])
})
