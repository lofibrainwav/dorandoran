import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canReadLifecycleItem,
  projectFamilyLifecycle,
  validateCaptureWrite,
} from '../../lib/family-os/index.ts'

function capture(overrides = {}) {
  return {
    id: 'cap-1',
    personId: 'julie',
    privacyScope: 'family',
    kind: 'want',
    statedText: 'stated as-is',
    source: 'human',
    occurredAt: '2026-09-08T10:00:00.000Z',
    capturedAt: '2026-09-08T10:00:05.000Z',
    capturedBy: 'julie',
    evidenceRefs: [],
    unknowns: [],
    ...overrides,
  }
}

// ---- Boundary ① write-time: validateCaptureWrite ----

test('writing into one\'s own lane is always allowed, whatever the scope', () => {
  for (const privacyScope of ['personal', 'family', 'professional']) {
    assert.deepEqual(
      validateCaptureWrite({
        capture: capture({ privacyScope }),
        session: { personId: 'julie', access: 'adult' },
        target: { personId: 'julie', access: 'adult' },
      }),
      { ok: true },
    )
  }
})

test('an adult can write family or personal captures into a child\'s lane, but never professional', () => {
  const asJayForJayden = (privacyScope) => validateCaptureWrite({
    capture: capture({ personId: 'jayden', privacyScope, capturedBy: 'jay' }),
    session: { personId: 'jay', access: 'adult' },
    target: { personId: 'jayden', access: 'child' },
  })
  assert.deepEqual(asJayForJayden('family'), { ok: true })
  assert.deepEqual(asJayForJayden('personal'), { ok: true })
  assert.deepEqual(asJayForJayden('professional'), { ok: false, code: 'PRIVACY_SCOPE_DENIED' })
})

test('Jay (adult) cannot write into Julie (adult) lane even with family scope', () => {
  const result = validateCaptureWrite({
    capture: capture({ personId: 'julie', privacyScope: 'family', capturedBy: 'jay' }),
    session: { personId: 'jay', access: 'adult' },
    target: { personId: 'julie', access: 'adult' },
  })
  assert.deepEqual(result, { ok: false, code: 'LANE_MISMATCH' })
})

test('a child cannot write into anyone else\'s lane', () => {
  const result = validateCaptureWrite({
    capture: capture({ personId: 'jay', privacyScope: 'family', capturedBy: 'jayden' }),
    session: { personId: 'jayden', access: 'child' },
    target: { personId: 'jay', access: 'adult' },
  })
  assert.deepEqual(result, { ok: false, code: 'LANE_MISMATCH' })
})

test('a child targeting another lane with professional scope fails on lane, not privacy scope', () => {
  const result = validateCaptureWrite({
    capture: capture({ personId: 'jay', privacyScope: 'professional', capturedBy: 'jayden' }),
    session: { personId: 'jayden', access: 'child' },
    target: { personId: 'jay', access: 'adult' },
  })
  assert.deepEqual(result, { ok: false, code: 'LANE_MISMATCH' })
})

test('a child cannot record a professional-scope capture, even in their own lane', () => {
  const result = validateCaptureWrite({
    capture: capture({ personId: 'jayden', privacyScope: 'professional', capturedBy: 'jayden' }),
    session: { personId: 'jayden', access: 'child' },
    target: { personId: 'jayden', access: 'child' },
  })
  assert.deepEqual(result, { ok: false, code: 'PRIVACY_SCOPE_DENIED' })
})

test('captures are not accepted through this validator unless capturedBy matches the session (chad has its own path later)', () => {
  const result = validateCaptureWrite({
    capture: capture({ capturedBy: 'chad' }),
    session: { personId: 'julie', access: 'adult' },
    target: { personId: 'julie', access: 'adult' },
  })
  assert.deepEqual(result, { ok: false, code: 'CAPTURED_BY_MISMATCH' })
})

// ---- Boundary ② read authorization: canReadLifecycleItem ----

test('a viewer can always read their own lane, regardless of scope', () => {
  for (const privacyScope of ['personal', 'family', 'professional']) {
    assert.equal(
      canReadLifecycleItem({ item: { personId: 'julie', privacyScope }, viewer: { personId: 'julie', access: 'adult' } }),
      true,
    )
  }
})

test('an adult viewing another lane sees family-scope items only', () => {
  assert.equal(
    canReadLifecycleItem({ item: { personId: 'julie', privacyScope: 'family' }, viewer: { personId: 'jay', access: 'adult' } }),
    true,
  )
  assert.equal(
    canReadLifecycleItem({ item: { personId: 'julie', privacyScope: 'personal' }, viewer: { personId: 'jay', access: 'adult' } }),
    false,
  )
})

test('a child viewing another lane sees nothing at all', () => {
  assert.equal(
    canReadLifecycleItem({ item: { personId: 'julie', privacyScope: 'family' }, viewer: { personId: 'jayden', access: 'child' } }),
    false,
  )
})

test('professional-scope items are never readable outside their own lane', () => {
  assert.equal(
    canReadLifecycleItem({ item: { personId: 'julie', privacyScope: 'professional' }, viewer: { personId: 'jay', access: 'adult' } }),
    false,
  )
})

test('an adult may read personal-scope items in a child\'s lane too — mirrors the proxy-write rule', () => {
  assert.equal(
    canReadLifecycleItem({
      item: { personId: 'jayden', privacyScope: 'personal', access: 'child' },
      viewer: { personId: 'jay', access: 'adult' },
    }),
    true,
  )
})

test('personal-scope items in an adult\'s lane stay invisible to another adult (access unspecified fails closed too)', () => {
  assert.equal(
    canReadLifecycleItem({
      item: { personId: 'julie', privacyScope: 'personal', access: 'adult' },
      viewer: { personId: 'jay', access: 'adult' },
    }),
    false,
  )
  assert.equal(
    canReadLifecycleItem({
      item: { personId: 'julie', privacyScope: 'personal' },
      viewer: { personId: 'jay', access: 'adult' },
    }),
    false,
  )
})

test('professional stays owner-only even for a child\'s lane', () => {
  assert.equal(
    canReadLifecycleItem({
      item: { personId: 'jayden', privacyScope: 'professional', access: 'child' },
      viewer: { personId: 'jay', access: 'adult' },
    }),
    false,
  )
})

// ---- Boundary ③ projection: projectFamilyLifecycle ----

test('projection keeps only family-scope items', () => {
  const items = [
    { id: 'a', privacyScope: 'family' },
    { id: 'b', privacyScope: 'personal' },
    { id: 'c', privacyScope: 'professional' },
  ]
  assert.deepEqual(projectFamilyLifecycle(items), [{ id: 'a', privacyScope: 'family' }])
})

test('an item with no privacyScope fails closed and is not treated as family', () => {
  const items = [{ id: 'a' }, { id: 'b', privacyScope: 'family' }]
  assert.deepEqual(projectFamilyLifecycle(items), [{ id: 'b', privacyScope: 'family' }])
})

// ---- Named cross-cutting boundary test ----

test('Julie professional never visible to Jay adult and never in family projection', () => {
  const julieProfessional = { id: 'cap-julie-work', personId: 'julie', privacyScope: 'professional' }

  assert.equal(
    canReadLifecycleItem({ item: julieProfessional, viewer: { personId: 'jay', access: 'adult' } }),
    false,
  )
  assert.deepEqual(
    projectFamilyLifecycle([julieProfessional, { id: 'cap-family', personId: 'julie', privacyScope: 'family' }]),
    [{ id: 'cap-family', personId: 'julie', privacyScope: 'family' }],
  )
})
