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

test('denied identities are logged only when the Preview discovery flag is on', async () => {
  const lines = []
  const base = {
    credential: 'fixture-token', clientId: 'fixture-client-id', membership,
    verifyIdToken: async () => ({ sub: 'unknown-sub', email: 'someone@example.invalid' }),
    log: (message) => lines.push(message),
  }

  assert.equal(await verifyGoogleHouseholdCredential({ ...base, env: {} }), null)
  assert.deepEqual(lines, [])

  assert.equal(await verifyGoogleHouseholdCredential({ ...base, env: { DORANDORAN_LOG_DENIED_IDENTITY: '1' } }), null)
  assert.deepEqual(lines, ['[household-auth] denied reason=unknown sub=unknown-sub emailDomain=example.invalid'])
  assert.ok(!lines[0].includes('fixture-token'))

  assert.equal(await verifyGoogleHouseholdCredential({
    ...base, env: { DORANDORAN_LOG_DENIED_IDENTITY: '1' },
    verifyIdToken: async () => ({ sub: 'sub-c' }),
  }), null)
  assert.equal(lines[1], '[household-auth] denied reason=child sub=sub-c emailDomain=(none)')
})
