import test from 'node:test'
import assert from 'node:assert/strict'

import { createMemoryLifecycleStore } from '../../lib/server/lifecycle-store.ts'

function capture(overrides = {}) {
  return {
    id: 'cap-1',
    personId: 'julie',
    privacyScope: 'family',
    kind: 'want',
    statedText: '주말에 자전거 타고 싶어',
    source: 'human',
    occurredAt: '2026-09-08T10:00:00.000Z',
    capturedAt: '2026-09-08T10:00:05.000Z',
    capturedBy: 'julie',
    evidenceRefs: ['ev-capture-1'],
    unknowns: [],
    ...overrides,
  }
}

function opportunity(overrides = {}) {
  return {
    id: 'opp-1',
    ownerId: 'julie',
    title: '자전거 라이딩',
    mode: 'physical',
    evidenceRefs: ['ev-capture-1'],
    ...overrides,
  }
}

function candidateRecord(overrides = {}) {
  return {
    id: 'cand-1',
    personId: 'julie',
    privacyScope: 'family',
    sourceCaptureId: 'cap-1',
    proposedBy: 'julie',
    opportunity: opportunity(),
    version: 1,
    createdAt: '2026-09-08T10:01:00.000Z',
    updatedAt: '2026-09-08T10:01:00.000Z',
    ...overrides,
  }
}

function familyBlock(overrides = {}) {
  return {
    id: 'task-1',
    type: 'action',
    workMode: 'physical',
    reality: { title: '자전거 라이딩', durationMinutes: 60 },
    evidenceRefs: ['ev-capture-1'],
    evidenceState: 'unknown',
    people: { subjectIds: ['julie'], physicalOwnerIds: [], approverIds: ['julie'], recipientIds: [] },
    digital: { jobs: [] },
    timeEngine: { protected: false },
    dependencyIds: [],
    childBlockIds: [],
    workState: 'open',
    candidateId: 'cand-1',
    privacyScope: 'family',
    ...overrides,
  }
}

function taskRecord(overrides = {}) {
  return {
    id: 'task-1',
    personId: 'julie',
    privacyScope: 'family',
    candidateId: 'cand-1',
    block: familyBlock(),
    workState: 'open',
    version: 1,
    createdAt: '2026-09-08T10:02:00.000Z',
    updatedAt: '2026-09-08T10:02:00.000Z',
    ...overrides,
  }
}

test('putCapture stores; duplicate id is rejected', async () => {
  const store = createMemoryLifecycleStore()
  await store.putCapture(capture())
  assert.deepEqual(await store.getCapture({ id: 'cap-1', personId: 'julie', scopes: ['family'] }), capture())
  await assert.rejects(() => store.putCapture(capture()), /LIFECYCLE_DUPLICATE_ID/)
})

test('getCapture returns null for a missing id', async () => {
  const store = createMemoryLifecycleStore()
  assert.equal(await store.getCapture({ id: 'missing', personId: 'julie', scopes: ['family'] }), null)
})

test('getCapture with an empty scopes array returns null without matching data', async () => {
  const store = createMemoryLifecycleStore()
  await store.putCapture(capture())
  assert.equal(await store.getCapture({ id: 'cap-1', personId: 'julie', scopes: [] }), null)
})

test('professional row is not returned by id to another lane', async () => {
  const store = createMemoryLifecycleStore()
  await store.putCapture(capture({ id: 'cap-pro', privacyScope: 'professional' }))

  // wrong personId, even with every scope
  assert.equal(
    await store.getCapture({ id: 'cap-pro', personId: 'jay', scopes: ['personal', 'family', 'professional'] }),
    null,
  )
  // right personId, but the scope list lacks 'professional'
  assert.equal(await store.getCapture({ id: 'cap-pro', personId: 'julie', scopes: ['personal', 'family'] }), null)
  // right personId and the scope is present: visible
  const visible = await store.getCapture({ id: 'cap-pro', personId: 'julie', scopes: ['professional'] })
  assert.equal(visible.id, 'cap-pro')

  await store.insertCandidate(candidateRecord({ id: 'cand-pro', privacyScope: 'professional' }))
  assert.equal(
    await store.getCandidate({ id: 'cand-pro', personId: 'jay', scopes: ['personal', 'family', 'professional'] }),
    null,
  )
  assert.equal(await store.getCandidate({ id: 'cand-pro', personId: 'julie', scopes: ['personal', 'family'] }), null)

  await store.insertTask(taskRecord({ id: 'task-pro', privacyScope: 'professional', candidateId: 'cand-pro' }))
  assert.equal(
    await store.getTask({ id: 'task-pro', personId: 'jay', scopes: ['personal', 'family', 'professional'] }),
    null,
  )
  assert.equal(await store.getTask({ id: 'task-pro', personId: 'julie', scopes: ['personal', 'family'] }), null)
})

test('listCaptures filters by personId and scopes; an empty scopes array returns [] (fail closed)', async () => {
  const store = createMemoryLifecycleStore()
  await store.putCapture(capture({ id: 'cap-family', privacyScope: 'family' }))
  await store.putCapture(capture({ id: 'cap-professional', privacyScope: 'professional' }))
  await store.putCapture(capture({ id: 'cap-other-person', personId: 'jay', privacyScope: 'family' }))

  const familyOnly = await store.listCaptures({ personId: 'julie', scopes: ['family'] })
  assert.deepEqual(
    familyOnly.map((item) => item.id).sort(),
    ['cap-family'],
  )

  const bothScopes = await store.listCaptures({ personId: 'julie', scopes: ['family', 'professional'] })
  assert.deepEqual(
    bothScopes.map((item) => item.id).sort(),
    ['cap-family', 'cap-professional'],
  )

  const noScopes = await store.listCaptures({ personId: 'julie', scopes: [] })
  assert.deepEqual(noScopes, [])
})

test('list methods clamp/validate limit: default 50, integer 1..500, invalid values throw', async () => {
  const store = createMemoryLifecycleStore()
  await store.putCapture(capture())

  await assert.rejects(
    () => store.listCaptures({ personId: 'julie', scopes: ['family'], limit: 0 }),
    /LIFECYCLE_LIMIT_INVALID/,
  )
  await assert.rejects(
    () => store.listCaptures({ personId: 'julie', scopes: ['family'], limit: -1 }),
    /LIFECYCLE_LIMIT_INVALID/,
  )
  await assert.rejects(
    () => store.listCaptures({ personId: 'julie', scopes: ['family'], limit: 1.5 }),
    /LIFECYCLE_LIMIT_INVALID/,
  )
  await assert.rejects(
    () => store.listCaptures({ personId: 'julie', scopes: ['family'], limit: Number.POSITIVE_INFINITY }),
    /LIFECYCLE_LIMIT_INVALID/,
  )

  // a limit above 500 is clamped, not rejected
  for (let i = 0; i < 3; i += 1) {
    await store.putCapture(capture({ id: `cap-extra-${i}` }))
  }
  const clamped = await store.listCaptures({ personId: 'julie', scopes: ['family'], limit: 10_000 })
  assert.ok(clamped.length <= 500)
})

test('insertCandidate stores; duplicate id is rejected', async () => {
  const store = createMemoryLifecycleStore()
  await store.insertCandidate(candidateRecord())
  assert.deepEqual(await store.getCandidate({ id: 'cand-1', personId: 'julie', scopes: ['family'] }), candidateRecord())
  await assert.rejects(() => store.insertCandidate(candidateRecord()), /LIFECYCLE_DUPLICATE_ID/)
})

test('updateCandidate enforces optimistic concurrency by version', async () => {
  const store = createMemoryLifecycleStore()
  await store.insertCandidate(candidateRecord())

  await assert.rejects(
    () => store.updateCandidate(candidateRecord({ proposedBy: 'chad-should-fail' }), 99),
    /LIFECYCLE_VERSION_CONFLICT/,
  )

  const decided = candidateRecord({
    opportunity: opportunity({ decision: { by: 'julie', at: '2026-09-08T10:05:00.000Z', kind: 'accept', evidenceRef: 'ev-decision-1' } }),
    decision: { by: 'julie', at: '2026-09-08T10:05:00.000Z', kind: 'accept', evidenceRef: 'ev-decision-1' },
    updatedAt: '2026-09-08T10:05:00.000Z',
  })
  await store.updateCandidate(decided, 1)

  const stored = await store.getCandidate({ id: 'cand-1', personId: 'julie', scopes: ['family'] })
  assert.equal(stored.version, 2)
  assert.equal(stored.decision.kind, 'accept')

  // Same expectedVersion (1) again must now fail — the row moved to version 2.
  await assert.rejects(() => store.updateCandidate(decided, 1), /LIFECYCLE_VERSION_CONFLICT/)
})

test('updateCandidate against a missing id is a version conflict, not a silent create', async () => {
  const store = createMemoryLifecycleStore()
  await assert.rejects(() => store.updateCandidate(candidateRecord(), 1), /LIFECYCLE_VERSION_CONFLICT/)
})

test('listCandidates filters by personId and scopes; empty scopes returns []', async () => {
  const store = createMemoryLifecycleStore()
  await store.insertCandidate(candidateRecord({ id: 'cand-family', privacyScope: 'family' }))
  await store.insertCandidate(candidateRecord({ id: 'cand-personal', privacyScope: 'personal' }))
  await store.insertCandidate(candidateRecord({ id: 'cand-other-person', personId: 'jay', privacyScope: 'family' }))

  const familyOnly = await store.listCandidates({ personId: 'julie', scopes: ['family'] })
  assert.deepEqual(familyOnly.map((item) => item.id), ['cand-family'])

  const noScopes = await store.listCandidates({ personId: 'julie', scopes: [] })
  assert.deepEqual(noScopes, [])
})

test('insertTask stores; duplicate id is rejected', async () => {
  const store = createMemoryLifecycleStore()
  await store.insertTask(taskRecord())
  assert.deepEqual(await store.getTask({ id: 'task-1', personId: 'julie', scopes: ['family'] }), taskRecord())
  await assert.rejects(() => store.insertTask(taskRecord()), /LIFECYCLE_DUPLICATE_ID/)
})

test('insertTask rejects a second task for the same candidateId with LIFECYCLE_CANDIDATE_ALREADY_TASKED', async () => {
  const store = createMemoryLifecycleStore()
  await store.insertTask(taskRecord({ id: 'task-first', candidateId: 'cand-shared' }))
  await assert.rejects(
    () => store.insertTask(taskRecord({ id: 'task-second', candidateId: 'cand-shared' })),
    /LIFECYCLE_CANDIDATE_ALREADY_TASKED/,
  )
})

test('updateTask enforces optimistic concurrency by version', async () => {
  const store = createMemoryLifecycleStore()
  await store.insertTask(taskRecord())

  await assert.rejects(() => store.updateTask(taskRecord({ workState: 'in_progress' }), 99), /LIFECYCLE_VERSION_CONFLICT/)

  const advanced = taskRecord({
    workState: 'in_progress',
    block: familyBlock({ workState: 'in_progress' }),
    updatedAt: '2026-09-08T10:10:00.000Z',
  })
  await store.updateTask(advanced, 1)

  const stored = await store.getTask({ id: 'task-1', personId: 'julie', scopes: ['family'] })
  assert.equal(stored.version, 2)
  assert.equal(stored.workState, 'in_progress')
})

test('listTasks filters by personId, scopes, and workStates; empty scopes returns []', async () => {
  const store = createMemoryLifecycleStore()
  await store.insertTask(taskRecord({ id: 'task-open', workState: 'open' }))
  await store.insertTask(taskRecord({ id: 'task-done', workState: 'done', candidateId: 'cand-2' }))
  await store.insertTask(taskRecord({ id: 'task-other-scope', privacyScope: 'personal', candidateId: 'cand-3' }))
  await store.insertTask(taskRecord({ id: 'task-other-person', personId: 'jay', candidateId: 'cand-4' }))

  const familyTasks = await store.listTasks({ personId: 'julie', scopes: ['family'] })
  assert.deepEqual(
    familyTasks.map((item) => item.id).sort(),
    ['task-done', 'task-open'],
  )

  const openOnly = await store.listTasks({ personId: 'julie', scopes: ['family'], workStates: ['open'] })
  assert.deepEqual(openOnly.map((item) => item.id), ['task-open'])

  const noScopes = await store.listTasks({ personId: 'julie', scopes: [] })
  assert.deepEqual(noScopes, [])
})

test('list ordering is deterministic (timestamp DESC, id ASC) even when timestamps tie', async () => {
  const store = createMemoryLifecycleStore()
  const sameTimestamp = '2026-09-08T10:00:00.000Z'
  await store.putCapture(capture({ id: 'cap-b', capturedAt: sameTimestamp }))
  await store.putCapture(capture({ id: 'cap-a', capturedAt: sameTimestamp }))
  await store.putCapture(capture({ id: 'cap-c', capturedAt: sameTimestamp }))

  const first = await store.listCaptures({ personId: 'julie', scopes: ['family'] })
  const second = await store.listCaptures({ personId: 'julie', scopes: ['family'] })
  assert.deepEqual(
    first.map((item) => item.id),
    ['cap-a', 'cap-b', 'cap-c'],
  )
  assert.deepEqual(first.map((item) => item.id), second.map((item) => item.id))
})

test('records returned by get/list are defensive copies — mutating them does not corrupt the store', async () => {
  const store = createMemoryLifecycleStore()
  await store.putCapture(capture())
  const read = await store.getCapture({ id: 'cap-1', personId: 'julie', scopes: ['family'] })
  read.statedText = 'MUTATED'
  const readAgain = await store.getCapture({ id: 'cap-1', personId: 'julie', scopes: ['family'] })
  assert.equal(readAgain.statedText, capture().statedText)
})
