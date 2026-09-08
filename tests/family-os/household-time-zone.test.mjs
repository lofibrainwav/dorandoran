import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveHouseholdTimeZone } from '../../lib/family-os/index.ts'

test('household time zone falls back to Los Angeles when unset', () => {
  assert.equal(resolveHouseholdTimeZone({}), 'America/Los_Angeles')
  assert.equal(resolveHouseholdTimeZone({ DORANDORAN_TIME_ZONE: '   ' }), 'America/Los_Angeles')
})

test('household time zone honours a valid IANA zone and rejects garbage', () => {
  assert.equal(resolveHouseholdTimeZone({ DORANDORAN_TIME_ZONE: 'Asia/Seoul' }), 'Asia/Seoul')
  assert.throws(() => resolveHouseholdTimeZone({ DORANDORAN_TIME_ZONE: 'Mars/Olympus' }), /INVALID_HOUSEHOLD_TIME_ZONE/)
})
