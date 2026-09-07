import test from 'node:test'
import assert from 'node:assert/strict'
import {
  weekInsightBadge,
  weekInsightBlockId,
} from '../../lib/family-os/index.ts'

function insight(overrides = {}) {
  return {
    eventId: 'same-event',
    targetEventId: 'calendar:family:same-event',
    title: 'ABA Center', protected: true,
    state: 'confirmed', nextStep: 'none', needsHumanAttention: false,
    changeKinds: [], hints: [], reality: {}, evidenceRefs: [],
    ...overrides,
  }
}

test('canonical calendar target maps to canonical FamilyBlock id', () => {
  assert.equal(weekInsightBlockId(insight()), 'event:family:same-event')
})

test('same raw provider event id in different calendars stays distinct', () => {
  const family = weekInsightBlockId(insight({ targetEventId: 'calendar:family:same-event' }))
  const jayden = weekInsightBlockId(insight({ targetEventId: 'calendar:jayden:same-event' }))
  assert.notEqual(family, jayden)
})

test('confirmed insight stays visually quiet', () => {
  assert.equal(weekInsightBadge(insight()), null)
})
test('meaningful states get small privacy-safe labels', () => {
  assert.deepEqual(weekInsightBadge(insight({ state: 'changed' })), { label: 'Updated', tone: 'info' })
  assert.deepEqual(weekInsightBadge(insight({ state: 'cancelled' })), { label: 'Cancelled', tone: 'danger' })
  assert.deepEqual(weekInsightBadge(insight({ state: 'recover' })), { label: 'Checking', tone: 'muted' })
  assert.deepEqual(weekInsightBadge(insight({ state: 'action' })), { label: 'Needs prep', tone: 'warning' })
})

test('invalid non-calendar target does not guess a block id', () => {
  assert.equal(weekInsightBlockId(insight({ targetEventId: 'gmail:message' })), null)
})
