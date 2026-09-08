import test from 'node:test'
import assert from 'node:assert/strict'

import { decideHouseholdAccess } from '../../lib/server/household-access-decision.ts'

const adult = { personId: 'adult-a', googleSub: '1', access: 'adult', roles: ['admin'], canSignIn: true }

test('incomplete Google identity configuration fails closed, there is no other door', () => {
  assert.deepEqual(decideHouseholdAccess({ pathname: '/family', googleComplete: false, membership: [adult], sessionMember: adult }), { kind: 'unavailable' })
})

test('unparsable or empty membership fails closed even with complete configuration', () => {
  assert.deepEqual(decideHouseholdAccess({ pathname: '/family', googleComplete: true, membership: null, sessionMember: null }), { kind: 'unavailable' })
  assert.deepEqual(decideHouseholdAccess({ pathname: '/family', googleComplete: true, membership: [], sessionMember: null }), { kind: 'unavailable' })
})

test('valid session passes; no session redirects to /signin; public paths always pass', () => {
  assert.deepEqual(decideHouseholdAccess({ pathname: '/family', googleComplete: true, membership: [adult], sessionMember: adult }), { kind: 'next' })
  assert.deepEqual(decideHouseholdAccess({ pathname: '/family', googleComplete: true, membership: [adult], sessionMember: null }), { kind: 'redirect', to: '/signin', status: 307 })
  assert.deepEqual(decideHouseholdAccess({ pathname: '/signin', googleComplete: false, membership: null, sessionMember: null }), { kind: 'next' })
  assert.deepEqual(decideHouseholdAccess({ pathname: '/unlock', googleComplete: true, membership: [adult], sessionMember: null }), { kind: 'redirect', to: '/signin', status: 307 })
})
