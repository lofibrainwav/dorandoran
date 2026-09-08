import test from 'node:test'
import assert from 'node:assert/strict'

import { parseHouseholdMembership, resolveUniqueChildPersonId } from '../../lib/family-os/index.ts'

test('unique explicit child becomes the default Jayden-centered subject', () => {
  const membership = parseHouseholdMembership({
    DORANDORAN_HOUSEHOLD_MEMBERS_JSON: JSON.stringify([
      { personId: 'adult-a', googleSub: 'sub-a', access: 'adult', roles: ['transport'] },
      { personId: 'child-a', googleSub: 'sub-c', access: 'child', roles: ['child'] },
    ]),
  })
  assert.equal(resolveUniqueChildPersonId(membership), 'child-a')
})

test('zero or multiple children stay unresolved instead of guessing', () => {
  assert.equal(resolveUniqueChildPersonId([]), null)
  const membership = parseHouseholdMembership({
    DORANDORAN_HOUSEHOLD_MEMBERS_JSON: JSON.stringify([
      { personId: 'child-a', googleSub: 'sub-a', access: 'child', roles: ['child'] },
      { personId: 'child-b', googleSub: 'sub-b', access: 'child', roles: ['child'] },
    ]),
  })
  assert.equal(resolveUniqueChildPersonId(membership), null)
})
