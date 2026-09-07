import test from 'node:test'
import assert from 'node:assert/strict'
import {
  projectWeekEventInsight,
  reconcileFactClaims,
} from '../../lib/family-os/index.ts'

function resolvedFact(fact, winner, previous) {
  return reconcileFactClaims([
    {
      id: previous.id, fact, value: previous.value, sourceRole: 'family_calendar',
      evidenceRef: previous.evidenceRef, observedAt: '2026-09-01T12:00:00Z',
    },
    {
      id: winner.id, fact, value: winner.value, sourceRole: 'direct_official',
      evidenceRef: winner.evidenceRef, observedAt: '2026-09-02T12:00:00Z',
    },
  ])
}

function baseReality() {
  return {
    eventId: 'aba-thu', targetEventId: 'calendar:family:aba-thu', title: 'ABA Center',
    protected: true,
    reality: { start: '15:00', end: '18:30', location: '12660 Riverside Drive' },
    facts: {},
    evidenceRefs: ['calendar:family:aba-thu'],
  }
}

test('source-backed time change becomes a change with transition review hint', () => {
  const reality = baseReality()
  reality.facts.start = resolvedFact('start',
    { id: 'provider:start', value: '15:00', evidenceRef: 'gmail:provider' },
    { id: 'calendar:start', value: '15:30', evidenceRef: 'calendar:family:aba-thu' })
  const insight = projectWeekEventInsight({ reality })
  assert.equal(insight.state, 'changed')
  assert.deepEqual(insight.changeKinds, ['start'])
  assert.equal(insight.hints.includes('review_transition'), true)
})

test('location change suggests route recheck', () => {
  const reality = baseReality()
  reality.facts.location = resolvedFact('location',
    { id: 'provider:location', value: 'New Center', evidenceRef: 'gmail:provider' },
    { id: 'calendar:location', value: 'Old Center', evidenceRef: 'calendar:family:aba-thu' })
  const insight = projectWeekEventInsight({ reality })
  assert.equal(insight.hints.includes('recheck_route'), true)
})

test('explicit cancellation is visible without erasing event identity', () => {
  const reality = baseReality()
  reality.reality.cancelled = true
  reality.facts.cancelled = {
    fact: 'cancelled', state: 'resolved', value: true, winnerClaimId: 'provider:closed',
    supersededClaimIds: [], evidenceRefs: ['gmail:provider'],
  }
  const insight = projectWeekEventInsight({ reality })
  assert.equal(insight.state, 'cancelled')
  assert.equal(insight.hints.includes('release_time_window'), true)
  assert.equal(insight.eventId, 'aba-thu')
})
test('fact conflict requests recover instead of immediate human ask', () => {
  const reality = baseReality()
  reality.facts.start = {
    fact: 'start', state: 'conflict', supersededClaimIds: [],
    evidenceRefs: ['gmail:a', 'gmail:b'],
  }
  const insight = projectWeekEventInsight({ reality })
  assert.equal(insight.state, 'recover')
  assert.equal(insight.nextStep, 'recover')
  assert.equal(insight.needsHumanAttention, false)
})

test('proven tight transition stays quiet when there is no source change', () => {
  const insight = projectWeekEventInsight({
    reality: baseReality(),
    transition: {
      tightness: 'high', friction: 'low', deviation: 'none',
      routineState: 'proven_tight_fit', slackMinutes: 6,
      reasons: ['FAMILY_ROUTINE_REPEATEDLY_FITS'],
    },
  })
  assert.equal(insight.state, 'confirmed')
  assert.equal(insight.hints.includes('route_friction'), false)
  assert.equal(insight.needsHumanAttention, false)
})

test('week insight contains no private mail fields', () => {
  const insight = projectWeekEventInsight({ reality: baseReality() })
  const serialized = JSON.stringify(insight)
  for (const forbidden of ['snippet', 'subject', 'privateBody', 'sender']) {
    assert.equal(serialized.includes(forbidden), false)
  }
})
