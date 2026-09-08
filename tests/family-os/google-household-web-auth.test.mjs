import test from 'node:test'
import assert from 'node:assert/strict'

import { parseHouseholdMembership } from '../../lib/family-os/index.ts'
import { verifyGoogleHouseholdCredential } from '../../lib/server/google-household-web-auth.ts'

const membership = parseHouseholdMembership({
  DORANDORAN_HOUSEHOLD_MEMBERS_JSON: JSON.stringify([
    { personId: 'adult-a', googleSub: 'sub-a', access: 'adult', roles: ['admin', 'transport'] },
    { personId: 'child-a', googleSub: 'sub-c', access: 'child', roles: ['child'] },
  ]),
})

test('verified Google subject resolves to an authorized adult household member', async () => {
  const result = await verifyGoogleHouseholdCredential({
    credential: 'fixture-token',
    clientId: 'fixture-client-id',
    membership,
    verifyIdToken: async () => ({ sub: 'sub-a', email: 'display@example.invalid' }),
  })

  assert.equal(result?.member.personId, 'adult-a')
  assert.equal(result?.googleSub, 'sub-a')
})

test('unknown and child Google identities cannot enter the management surface', async () => {
  assert.equal(await verifyGoogleHouseholdCredential({
    credential: 'fixture-token', clientId: 'fixture-client-id', membership,
    verifyIdToken: async () => ({ sub: 'unknown' }),
  }), null)

  assert.equal(await verifyGoogleHouseholdCredential({
    credential: 'fixture-token', clientId: 'fixture-client-id', membership,
    verifyIdToken: async () => ({ sub: 'sub-c' }),
  }), null)
})

test('missing token identity fails closed', async () => {
  assert.equal(await verifyGoogleHouseholdCredential({
    credential: 'fixture-token', clientId: 'fixture-client-id', membership,
    verifyIdToken: async () => ({ email: 'display@example.invalid' }),
  }), null)
})
