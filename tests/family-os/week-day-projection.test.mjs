import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeAdapterOutput, projectWeekDays } from '../../lib/family-os/index.ts'

const tz = 'America/Los_Angeles'
const observations = normalizeAdapterOutput('calendar:test', [
  {
    id: 'ctx-1', kind: 'schedule', sourceRef: 'ev-1', observedAt: '2026-09-08T00:00:00Z',
    evidenceState: 'confirmed', evidenceRefs: ['ev-1'], continuity: { recordedAt: '2026-09-08T00:00:00Z' },
    sixW1H: { who: { personIds: ['child-a'] }, what: { label: 'Swim', ref: 'ev-1' },
      when: { start: '2026-09-09T00:30:00Z', end: '2026-09-09T01:30:00Z', timeZone: tz } },
  },
  {
    id: 'ctx-2', kind: 'schedule', sourceRef: 'ev-2', observedAt: '2026-09-08T00:00:00Z',
    evidenceState: 'confirmed', evidenceRefs: ['ev-2'], continuity: { recordedAt: '2026-09-08T00:00:00Z' },
    sixW1H: { who: { personIds: ['child-a'] }, what: { label: 'School', ref: 'ev-2' },
      when: { start: '2026-09-08T15:00:00Z', end: '2026-09-08T21:00:00Z', timeZone: tz } },
  },
  {
    id: 'ctx-3', kind: 'schedule', sourceRef: 'ev-3', observedAt: '2026-09-08T00:00:00Z',
    evidenceState: 'confirmed', evidenceRefs: ['ev-3'], continuity: { recordedAt: '2026-09-08T00:00:00Z' },
    sixW1H: { who: { personIds: ['child-a'] }, what: { label: 'Next week', ref: 'ev-3' },
      when: { start: '2026-09-16T15:00:00Z', end: '2026-09-16T16:00:00Z', timeZone: tz } },
  },
])

test('week days are Sunday-first, local-zoned, and only hold this week', () => {
  const week = projectWeekDays({ observations, now: new Date('2026-09-08T16:00:00Z'), timeZone: tz })
  assert.equal(week.days.length, 7)
  assert.equal(week.days[0].localDate, '2026-09-06')
  assert.deepEqual(week.days.map((d) => d.weekday), ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
  const tuesday = week.days.find((d) => d.localDate === '2026-09-08')
  // 2026-09-09T00:30Z is still Tuesday evening in Los Angeles.
  assert.deepEqual(tuesday.items.map((i) => i.title), ['School', 'Swim'])
  assert.equal(tuesday.items[1].clock, '5:30 PM')
  assert.equal(tuesday.isToday, true)
  assert.equal(week.days.flatMap((d) => d.items).length, 2)
})

test('week days never invent items and expose an explicit empty state', () => {
  const week = projectWeekDays({ observations: [], now: new Date('2026-09-08T16:00:00Z'), timeZone: tz })
  assert.equal(week.days.every((d) => d.items.length === 0), true)
  assert.equal(week.itemCount, 0)
})

function obs(id, label, start, end) {
  return normalizeAdapterOutput('calendar:test', [{
    id, kind: 'schedule', sourceRef: id, observedAt: '2026-09-08T00:00:00Z',
    evidenceState: 'confirmed', evidenceRefs: [id], continuity: { recordedAt: '2026-09-08T00:00:00Z' },
    sixW1H: { who: { personIds: ['child-a'] }, what: { label, ref: id }, when: { start, end, timeZone: tz } },
  }])[0]
}

test('week window boundaries: start-of-week is included, next Sunday midnight is excluded', () => {
  // Los Angeles week of 2026-09-06 runs 2026-09-06T07:00Z .. 2026-09-13T07:00Z (PDT).
  const atStart = obs('a', 'At start', '2026-09-06T07:00:00Z', '2026-09-06T08:00:00Z')
  const atEnd = obs('b', 'At end', '2026-09-13T07:00:00Z', '2026-09-13T08:00:00Z')
  const week = projectWeekDays({ observations: [atStart, atEnd], now: new Date('2026-09-08T16:00:00Z'), timeZone: tz })
  assert.deepEqual(week.days.flatMap((d) => d.items.map((i) => i.title)), ['At start'])
  assert.equal(week.days[0].items[0].title, 'At start')
})

test('an event that began last week but is still running shows on the first day it overlaps', () => {
  const carried = obs('c', 'Trip', '2026-09-04T15:00:00Z', '2026-09-07T15:00:00Z')
  const week = projectWeekDays({ observations: [carried], now: new Date('2026-09-08T16:00:00Z'), timeZone: tz })
  assert.equal(week.days[0].localDate, '2026-09-06')
  assert.equal(week.days[0].items[0].title, 'Trip')
  assert.equal(week.days[0].items[0].continued, true)
})

test('positive-offset zones bucket midnight-adjacent events on the correct local day', () => {
  const seoul = 'Asia/Seoul'
  // 2026-09-08T15:30Z is 00:30 on 2026-09-09 in Seoul.
  const late = obs('s', 'Late', '2026-09-08T15:30:00Z', '2026-09-08T16:00:00Z')
  const week = projectWeekDays({ observations: [late], now: new Date('2026-09-08T03:00:00Z'), timeZone: seoul })
  assert.equal(week.days[0].localDate, '2026-09-06')
  const wed = week.days.find((d) => d.localDate === '2026-09-09')
  assert.equal(wed.items[0].title, 'Late')
  assert.equal(wed.items[0].clock, '12:30 AM')
})

test('all-day facts land on their calendar date regardless of zone and sort before timed items; subjects pass through', () => {
  const allDay = normalizeAdapterOutput('calendar:test', [{
    id: 'ad', kind: 'schedule-all-day', sourceRef: 'ad', observedAt: '2026-09-08T00:00:00Z',
    evidenceState: 'confirmed', evidenceRefs: ['ad'], continuity: { recordedAt: '2026-09-08T00:00:00Z' },
    sixW1H: { who: { personIds: [] }, what: { label: 'Passport expiry', ref: 'ad' }, when: { start: '2026-09-08', end: '2026-09-09', timeZone: tz } },
  }])[0]
  const timed = obs('t', 'School', '2026-09-08T15:00:00Z', '2026-09-08T21:00:00Z')
  const week = projectWeekDays({ observations: [timed, allDay], now: new Date('2026-09-08T16:00:00Z'), timeZone: tz })
  const tuesday = week.days.find((d) => d.localDate === '2026-09-08')
  assert.deepEqual(tuesday.items.map((i) => i.title), ['Passport expiry', 'School'])
  assert.equal(tuesday.items[0].allDay, true)
  assert.equal(tuesday.items[0].clock, null)
  assert.deepEqual(tuesday.items[0].subjectIds, [])
  assert.deepEqual(tuesday.items[1].subjectIds, ['child-a'])
  // Multi-day all-day: 2026-09-05..09-07 (end exclusive) overlaps Sunday 09-06 → shown once, on Sunday.
  const span = normalizeAdapterOutput('calendar:test', [{
    id: 'sp', kind: 'schedule-all-day', sourceRef: 'sp', observedAt: '2026-09-08T00:00:00Z',
    evidenceState: 'confirmed', evidenceRefs: ['sp'], continuity: { recordedAt: '2026-09-08T00:00:00Z' },
    sixW1H: { who: { personIds: [] }, what: { label: 'Trip', ref: 'sp' }, when: { start: '2026-09-05', end: '2026-09-07', timeZone: tz } },
  }])[0]
  const week2 = projectWeekDays({ observations: [span], now: new Date('2026-09-08T16:00:00Z'), timeZone: tz })
  assert.equal(week2.days[0].items[0].title, 'Trip')
  assert.equal(week2.days[0].items[0].continued, true)
  assert.equal(week2.itemCount, 1)
})

test('all-day exclusive week bounds and invalid date ranges never create scheduled facts', () => {
  const facts = [
    obs('before', 'Before', '2026-09-05', '2026-09-06'),
    obs('next', 'Next week', '2026-09-13', '2026-09-14'),
    obs('valid', 'This Sunday', '2026-09-06', '2026-09-07'),
    obs('reversed', 'Reversed', '2026-09-09', '2026-09-08'),
    obs('empty', 'Zero days', '2026-09-08', '2026-09-08'),
    obs('invalid', 'Invalid date', '2026-02-30', '2026-09-09'),
    obs('mixed', 'Mixed range', '2026-09-08', '2026-09-09T00:00:00Z'),
  ]
  for (const timeZone of [tz, 'Asia/Seoul']) {
    const week = projectWeekDays({ observations: facts, now: new Date('2026-09-08T03:00:00Z'), timeZone })
    assert.deepEqual(week.days.flatMap((day) => day.items.map((item) => item.title)), ['This Sunday'])
    assert.equal(week.days[0].items[0].clock, null)
  }
})
