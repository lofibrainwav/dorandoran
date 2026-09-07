import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileFactClaims } from '../../lib/family-os/index.ts'

function claim(overrides = {}) {
  return {
    id: 'claim-1',
    fact: 'start',
    value: '15:30',
    sourceRole: 'family_calendar',
    evidenceRef: 'evidence-1',
    observedAt: '2026-09-01T12:00:00Z',
    ...overrides,
  }
}

test('newer direct provider time overrides recurring Family Calendar time', () => {
  const result = reconcileFactClaims([
    claim(),
    claim({ id: 'provider', value: '15:00', sourceRole: 'direct_official', evidenceRef: 'email-1', observedAt: '2026-09-02T12:00:00Z' }),
  ])
  assert.equal(result.state, 'resolved')
  assert.equal(result.value, '15:00')
  assert.equal(result.winnerClaimId, 'provider')
  assert.deepEqual(result.supersededClaimIds, ['claim-1'])
})
test('provider location claim does not alter separately reconciled calendar time', () => {
  const time = reconcileFactClaims([claim()])
  const location = reconcileFactClaims([
    claim({ id: 'old-place', fact: 'location', value: 'Old Studio', evidenceRef: 'calendar-place' }),
    claim({ id: 'new-place', fact: 'location', value: 'New Studio', sourceRole: 'direct_official', evidenceRef: 'email-place', observedAt: '2026-09-05T12:00:00Z' }),
  ])
  assert.equal(time.value, '15:30')
  assert.equal(location.value, 'New Studio')
})

test('direct cancellation overrides a protected calendar occurrence', () => {
  const result = reconcileFactClaims([
    claim({ fact: 'cancelled', value: false, evidenceRef: 'calendar-open' }),
    claim({ id: 'closure', fact: 'cancelled', value: true, sourceRole: 'direct_official', evidenceRef: 'official-closure', observedAt: '2026-09-06T12:00:00Z' }),
  ])
  assert.equal(result.value, true)
})

test('same-tier same-time contradiction remains conflict', () => {
  const result = reconcileFactClaims([
    claim({ id: 'a', sourceRole: 'direct_official', value: '15:00' }),
    claim({ id: 'b', sourceRole: 'direct_official', value: '16:00' }),
  ])
  assert.equal(result.state, 'conflict')
  assert.equal(result.value, undefined)
})