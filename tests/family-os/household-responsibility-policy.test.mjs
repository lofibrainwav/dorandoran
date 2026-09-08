import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseHouseholdMembership,
  resolveHouseholdResponsibilityDefaults,
  parseResponsibilityOverrides,
  resolveEventResponsibility,
} from '../../lib/family-os/index.ts'

const membership = parseHouseholdMembership({
  DORANDORAN_HOUSEHOLD_MEMBERS_JSON: JSON.stringify([
    { personId: 'adult-transport', googleSub: 'sub-a', access: 'adult', roles: ['admin', 'transport'] },
    { personId: 'adult-scheduler', googleSub: 'sub-b', access: 'adult', roles: ['admin', 'scheduler'] },
    { personId: 'child-a', googleSub: 'sub-c', access: 'child', roles: ['child'] },
  ]),
})

test('household responsibility defaults come only from unique explicit adult roles', () => {
  assert.deepEqual(resolveHouseholdResponsibilityDefaults(membership), {
    schedulerPersonId: 'adult-scheduler',
    transportPersonId: 'adult-transport',
  })
})

test('ambiguous responsibility role remains unresolved instead of guessing', () => {
  const ambiguous = parseHouseholdMembership({
    DORANDORAN_HOUSEHOLD_MEMBERS_JSON: JSON.stringify([
      { personId: 'adult-a', googleSub: 'sub-a', access: 'adult', roles: ['scheduler'] },
      { personId: 'adult-b', googleSub: 'sub-b', access: 'adult', roles: ['scheduler'] },
    ]),
  })
  assert.deepEqual(resolveHouseholdResponsibilityDefaults(ambiguous), {
    schedulerPersonId: null,
    transportPersonId: null,
  })
})

test('event override has priority over series override then household default', () => {
  const overrides = parseResponsibilityOverrides({
    DORANDORAN_RESPONSIBILITY_OVERRIDES_JSON: JSON.stringify([
      { kind: 'series', sourceId: 'series-1', responsibility: 'transport', personId: 'adult-scheduler' },
      { kind: 'event', sourceId: 'event-special', responsibility: 'transport', personId: 'adult-transport' },
    ]),
  })
  const defaults = resolveHouseholdResponsibilityDefaults(membership)

  assert.equal(resolveEventResponsibility({
    responsibility: 'transport', eventId: 'event-1', recurringEventId: 'series-1', defaults, overrides,
  }), 'adult-scheduler')

  assert.equal(resolveEventResponsibility({
    responsibility: 'transport', eventId: 'event-special', recurringEventId: 'series-1', defaults, overrides,
  }), 'adult-transport')

  assert.equal(resolveEventResponsibility({
    responsibility: 'scheduler', eventId: 'event-unknown', recurringEventId: 'series-unknown', defaults, overrides,
  }), 'adult-scheduler')
})

test('responsibility override must target an explicit household member at validation boundary', () => {
  const overrides = parseResponsibilityOverrides({
    DORANDORAN_RESPONSIBILITY_OVERRIDES_JSON: JSON.stringify([
      { kind: 'event', sourceId: 'event-1', responsibility: 'transport', personId: 'not-a-member' },
    ]),
  })
  assert.throws(
    () => resolveEventResponsibility({
      responsibility: 'transport', eventId: 'event-1', defaults: resolveHouseholdResponsibilityDefaults(membership), overrides, membership,
    }),
    /RESPONSIBILITY_OVERRIDE_MEMBER_UNKNOWN/,
  )
})
