import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseHouseholdMembership,
  resolveHouseholdMember,
  resolveOperationalFamilyCalendar,
  parseCalendarSubjectRules,
  resolveCalendarEventSubject,
} from '../../lib/family-os/index.ts'

test('household membership authorizes only explicit Google sub identities', () => {
  const env = {
    DORANDORAN_HOUSEHOLD_MEMBERS_JSON: JSON.stringify([
      { personId: 'adult-a', googleSub: 'sub-a', access: 'adult', roles: ['admin', 'transport'] },
      { personId: 'adult-b', googleSub: 'sub-b', access: 'adult', roles: ['admin', 'scheduler'] },
      { personId: 'child-a', googleSub: 'sub-c', access: 'child', roles: ['child'] },
    ]),
  }

  const membership = parseHouseholdMembership(env)
  assert.equal(membership.length, 3)

  const adult = resolveHouseholdMember({ sub: 'sub-a', email: 'display@example.invalid' }, membership)
  assert.ok(adult)
  assert.equal(adult.personId, 'adult-a')
  assert.equal(adult.canSignIn, true)
  assert.deepEqual(adult.roles, ['admin', 'transport'])

  assert.equal(resolveHouseholdMember({ sub: 'unknown', email: 'display@example.invalid' }, membership), null)
})

test('child identity remains known but cannot enter management surface', () => {
  const membership = parseHouseholdMembership({
    DORANDORAN_HOUSEHOLD_MEMBERS_JSON: JSON.stringify([
      { personId: 'child-a', googleSub: 'sub-c', access: 'child', roles: ['child'] },
    ]),
  })

  const child = resolveHouseholdMember({ sub: 'sub-c' }, membership)
  assert.ok(child)
  assert.equal(child.personId, 'child-a')
  assert.equal(child.canSignIn, false)
})

test('household membership rejects duplicate person or Google subject identity', () => {
  assert.throws(() => parseHouseholdMembership({
    DORANDORAN_HOUSEHOLD_MEMBERS_JSON: JSON.stringify([
      { personId: 'adult-a', googleSub: 'sub-a', access: 'adult', roles: ['admin'] },
      { personId: 'adult-a', googleSub: 'sub-b', access: 'adult', roles: ['scheduler'] },
    ]),
  }), /DUPLICATE_HOUSEHOLD_PERSON/)

  assert.throws(() => parseHouseholdMembership({
    DORANDORAN_HOUSEHOLD_MEMBERS_JSON: JSON.stringify([
      { personId: 'adult-a', googleSub: 'sub-a', access: 'adult', roles: ['admin'] },
      { personId: 'adult-b', googleSub: 'sub-a', access: 'adult', roles: ['scheduler'] },
    ]),
  }), /DUPLICATE_GOOGLE_SUB/)
})

test('operational family calendar uses immutable configured ID, not display name', () => {
  assert.equal(resolveOperationalFamilyCalendar({
    DORANDORAN_FAMILY_CALENDAR_ID: 'opaque-family-calendar-id',
  }), 'opaque-family-calendar-id')
  assert.equal(resolveOperationalFamilyCalendar({}), null)
})

test('event subject resolver uses explicit event then series rules and never title inference', () => {
  const rules = parseCalendarSubjectRules({
    DORANDORAN_CALENDAR_SUBJECT_RULES_JSON: JSON.stringify([
      { kind: 'series', sourceId: 'series-1', personId: 'child-a' },
      { kind: 'event', sourceId: 'event-special', personId: 'adult-b' },
    ]),
  })

  assert.equal(resolveCalendarEventSubject({
    id: 'event-1', recurringEventId: 'series-1', summary: 'Swimming lesson',
  }, rules), 'child-a')

  assert.equal(resolveCalendarEventSubject({
    id: 'event-special', recurringEventId: 'series-1', summary: 'Swimming lesson',
  }, rules), 'adult-b')

  assert.equal(resolveCalendarEventSubject({
    id: 'event-unknown', recurringEventId: 'series-unknown', summary: 'Swimming lesson',
  }, rules), null)
})

test('production-shaped membership: two numeric adult subs coexist with a non-numeric child placeholder', () => {
  const jaySub = '111111111111111111111'
  const julieSub = '222222222222222222222'
  const membership = parseHouseholdMembership({
    DORANDORAN_HOUSEHOLD_MEMBERS_JSON: JSON.stringify([
      { personId: 'jay', googleSub: jaySub, access: 'adult', roles: ['admin', 'transport'] },
      { personId: 'julie', googleSub: julieSub, access: 'adult', roles: ['admin', 'scheduler'] },
      { personId: 'jayden', googleSub: 'PENDING-JAYDEN-SUB-CHILD-NO-SIGNIN', access: 'child', roles: ['child'] },
    ]),
  })
  assert.equal(membership.length, 3)

  const julie = resolveHouseholdMember({ sub: julieSub, email: 'display@example.invalid' }, membership)
  assert.ok(julie)
  assert.equal(julie.personId, 'julie')
  assert.equal(julie.canSignIn, true)
  assert.deepEqual(julie.roles, ['admin', 'scheduler'])

  // The placeholder must never match a real or partial Google subject.
  assert.equal(resolveHouseholdMember({ sub: 'PENDING' }, membership), null)
  assert.equal(resolveHouseholdMember({ sub: '' }, membership), null)
  const placeholder = resolveHouseholdMember({ sub: 'PENDING-JAYDEN-SUB-CHILD-NO-SIGNIN' }, membership)
  assert.ok(placeholder)
  assert.equal(placeholder.canSignIn, false)
})
