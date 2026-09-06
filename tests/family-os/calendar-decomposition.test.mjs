import test from 'node:test'
import assert from 'node:assert/strict'
import { decomposeCalendarEvent } from '../../lib/family-os/index.ts'

const observedAt = '2026-09-06T20:00:00.000Z'
const confirmed = [{ id: 'cal-1', sourceType: 'calendar', observedAt, state: 'confirmed' }]

test('confirmed calendar event becomes one protected HOLD FamilyBlock', () => {
  const [block] = decomposeCalendarEvent({
    id: 'evt-1', title: 'Swim lesson', start: '2026-09-10T18:45:00-07:00',
    end: '2026-09-10T19:15:00-07:00', location: 'Pool A', evidence: confirmed,
  })
  assert.equal(block.id, 'event:evt-1')
  assert.equal(block.type, 'event')
  assert.equal(block.reality.title, 'Swim lesson')
  assert.equal(block.reality.location, 'Pool A')
  assert.equal(block.evidenceState, 'confirmed')
  assert.equal(block.timeEngine.protected, true)
  assert.equal(block.workState, 'hold')
})

test('free text does not invent child tasks; only explicit actions do', () => {
  const blocks = decomposeCalendarEvent({
    id: 'evt-2', title: 'Practice', description: 'Remember towel and water', evidence: confirmed,
    explicitActions: [{ id: 'pack', title: 'Pack bag', mode: 'physical', physicalOwnerIds: ['person-a'] }],
  })
  assert.equal(blocks.length, 2)
  assert.deepEqual(blocks[0].childBlockIds, ['action:evt-2:pack'])
  assert.equal(blocks[1].reality.title, 'Pack bag')
  assert.deepEqual(blocks[1].people.physicalOwnerIds, ['person-a'])
})
test('dirty optional metadata does not throw and UNKNOWN stays UNKNOWN', () => {
  const [block] = decomposeCalendarEvent({
    id: 'evt-3', title: 'Unknown place', location: { dirty: true },
    evidence: [{ id: 'cal-unknown', sourceType: 'calendar', observedAt, state: 'unknown' }],
  })
  assert.equal(block.reality.location, undefined)
  assert.equal(block.evidenceState, 'unknown')
  assert.equal(block.workState, 'open')
})

test('explicit unprotected event stays movable by policy projection', () => {
  const [block] = decomposeCalendarEvent({
    id: 'evt-4', title: 'Flexible hold', protected: false, evidence: confirmed,
  })
  assert.equal(block.timeEngine.protected, false)
})
