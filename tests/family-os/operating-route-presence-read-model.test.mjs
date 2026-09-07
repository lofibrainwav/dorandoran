import test from 'node:test'
import assert from 'node:assert/strict'
import {
  projectOperatingPresence,
  projectOperatingRoute,
} from '../../lib/family-os/index.ts'

test('confirmed live presence requires valid observed time and evidence', () => {
  const presence = projectOperatingPresence({
    state: 'confirmed_live',
    placeRef: 'place:private-safe-ref',
    observedAt: '2026-09-07T21:00:00.000Z',
    evidenceRefs: ['presence:e1'],
  })
  assert.equal(presence.state, 'live')
  assert.equal(presence.label, 'Live')
  assert.equal(presence.placeRef, 'place:private-safe-ref')
})

test('last known presence never becomes live', () => {
  const presence = projectOperatingPresence({
    state: 'last_known',
    placeRef: 'place:last',
    observedAt: '2026-09-07T20:00:00.000Z',
    evidenceRefs: ['presence:e2'],
  })
  assert.equal(presence.state, 'last_known')
  assert.equal(presence.label, 'Last known')
})
test('missing live evidence fails closed to unknown', () => {
  const presence = projectOperatingPresence({
    state: 'confirmed_live',
    placeRef: 'place:should-not-pass',
    observedAt: '2026-09-07T21:00:00.000Z',
    evidenceRefs: [],
  })
  assert.deepEqual(presence, { state: 'unknown', label: 'Unknown', evidenceRefs: [] })
})

test('proven tight route is clear rather than friction', () => {
  const route = projectOperatingRoute({
    assessment: {
      tightness: 'high', friction: 'low', deviation: 'none',
      routineState: 'proven_tight_fit', slackMinutes: 3,
      reasons: ['FAMILY_ROUTINE_REPEATEDLY_FITS'],
    },
    evidenceRefs: ['route:e1'],
  })
  assert.equal(route.state, 'clear')
  assert.equal(route.routineState, 'proven_tight_fit')
  assert.equal(route.slackMinutes, 3)
})
test('route watch and friction stay distinct', () => {
  const watch = projectOperatingRoute({
    assessment: { tightness: 'medium', friction: 'medium', deviation: 'small', routineState: 'watch', reasons: ['ROUTE_FITS_BUT_ROUTINE_EVIDENCE_LIMITED'] },
    evidenceRefs: ['route:e2'],
  })
  const friction = projectOperatingRoute({
    assessment: { tightness: 'high', friction: 'high', deviation: 'meaningful', routineState: 'friction', reasons: ['EXPECTED_TRAVEL_EXCEEDS_GAP'] },
    evidenceRefs: ['route:e3'],
  })
  assert.equal(watch.state, 'watch')
  assert.equal(friction.state, 'friction')
})

test('route with no evidence fails closed to unknown', () => {
  const route = projectOperatingRoute({
    assessment: { tightness: 'low', friction: 'low', deviation: 'none', routineState: 'normal_fit', reasons: [] },
    evidenceRefs: [],
  })
  assert.equal(route.state, 'unknown')
  assert.deepEqual(route.evidenceRefs, [])
})
