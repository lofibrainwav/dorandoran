import test from 'node:test'
import assert from 'node:assert/strict'

import {
  HOUSEHOLD_SESSION_COOKIE,
  householdSessionToken,
  verifyHouseholdSessionToken,
} from '../../lib/server/google-household-session.ts'

test('household session signs only opaque Google subject and expiry', async () => {
  const expiresAt = Date.UTC(2026, 8, 15, 12, 0, 0)
  const token = await householdSessionToken('google-sub-fixture', 'auth-secret-a', expiresAt)

  assert.equal(token.includes('google-sub-fixture'), false)
  assert.equal(token.includes('auth-secret-a'), false)
  assert.match(token, /^[0-9]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)

  const verified = await verifyHouseholdSessionToken(token, 'auth-secret-a', expiresAt - 1)
  assert.deepEqual(verified, { googleSub: 'google-sub-fixture', expiresAt })
})

test('household session rejects expiry, tampering and wrong secret', async () => {
  const expiresAt = Date.UTC(2026, 8, 15, 12, 0, 0)
  const token = await householdSessionToken('google-sub-fixture', 'auth-secret-a', expiresAt)

  assert.equal(await verifyHouseholdSessionToken(token, 'auth-secret-a', expiresAt), null)
  assert.equal(await verifyHouseholdSessionToken(`${token}x`, 'auth-secret-a', expiresAt - 1), null)
  assert.equal(await verifyHouseholdSessionToken(token, 'auth-secret-b', expiresAt - 1), null)
  assert.equal(await verifyHouseholdSessionToken('bad', 'auth-secret-a', expiresAt - 1), null)
})

test('household auth uses a versioned cookie distinct from legacy access gate', () => {
  assert.equal(HOUSEHOLD_SESSION_COOKIE, 'dorandoran_household_v1')
})
