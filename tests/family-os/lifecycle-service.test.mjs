import test from 'node:test'
import assert from 'node:assert/strict'

import { canReadLifecycleItem } from '../../lib/family-os/index.ts'
import { createLifecycleService, lifecycleErrorToHttp, readableScopes } from '../../lib/server/lifecycle-service.ts'
import { createMemoryLifecycleStore } from '../../lib/server/lifecycle-store.ts'

const MEMBERSHIP = [
  { personId: 'jay', googleSub: 'sub-jay', access: 'adult', roles: ['admin'], canSignIn: true },
  { personId: 'julie', googleSub: 'sub-julie', access: 'adult', roles: ['admin'], canSignIn: true },
  { personId: 'jayden', googleSub: 'sub-jayden', access: 'child', roles: ['child'], canSignIn: false },
]

function viewerFor(personId) {
  const member = MEMBERSHIP.find((candidate) => candidate.personId === personId)
  if (!member) throw new Error(`no fixture member for ${personId}`)
  return member
}

function makeClock(startIso) {
  let currentMs = Date.parse(startIso)
  return () => {
    currentMs += 1000
    return new Date(currentMs).toISOString()
  }
}

function makeIdGen(prefix) {
  let counter = 0
  return () => `${prefix}-${(counter += 1)}`
}

function buildService(overrides = {}) {
  const store = overrides.store ?? createMemoryLifecycleStore()
  const now = overrides.now ?? makeClock('2026-09-08T10:00:00.000Z')
  const newId = overrides.newId ?? makeIdGen('id')
  const membership = overrides.membership ?? MEMBERSHIP
  return { service: createLifecycleService({ store, membership, now, newId }), store }
}

async function expectHttp(promise, expected) {
  try {
    await promise
    assert.fail('expected the promise to reject')
  } catch (error) {
    assert.deepEqual(lifecycleErrorToHttp(error), expected)
  }
}

// ---- readableScopes cross-check against A1's canReadLifecycleItem (all 12 combinations) ----

test('readableScopes agrees with canReadLifecycleItem for every (access, lane, scope) combination', () => {
  const scopes = ['personal', 'family', 'professional']
  const viewers = [
    { personId: 'jay', access: 'adult' },
    { personId: 'jayden', access: 'child' },
  ]
  for (const viewer of viewers) {
    for (const targetPersonId of [viewer.personId, 'someone-else']) {
      const allowed = readableScopes(viewer, targetPersonId)
      for (const privacyScope of scopes) {
        const expected = canReadLifecycleItem({ item: { personId: targetPersonId, privacyScope }, viewer })
        assert.equal(
          allowed.includes(privacyScope),
          expected,
          `${viewer.personId}(${viewer.access}) -> ${targetPersonId} / ${privacyScope}`,
        )
      }
    }
  }
})

// [product decision, flagged for review] an adult reading a *child's* lane additionally gets
// `personal`, mirroring the adult proxy-write rule — a plain adult-over-adult lane stays
// family-only. readableScopes' 3rd argument and canReadLifecycleItem's `item.access` must agree.
test('readableScopes and canReadLifecycleItem agree that an adult may read a child lane\'s personal scope too', () => {
  const jay = { personId: 'jay', access: 'adult' }
  const scopes = ['personal', 'family', 'professional']

  const allowedForChildLane = readableScopes(jay, 'jayden', 'child')
  assert.deepEqual(allowedForChildLane, ['personal', 'family'])
  for (const privacyScope of scopes) {
    const expected = canReadLifecycleItem({ item: { personId: 'jayden', privacyScope, access: 'child' }, viewer: jay })
    assert.equal(allowedForChildLane.includes(privacyScope), expected, `jayden(child) / ${privacyScope}`)
  }

  const allowedForAdultLane = readableScopes(jay, 'julie', 'adult')
  assert.deepEqual(allowedForAdultLane, ['family'])
  for (const privacyScope of scopes) {
    const expected = canReadLifecycleItem({ item: { personId: 'julie', privacyScope, access: 'adult' }, viewer: jay })
    assert.equal(allowedForAdultLane.includes(privacyScope), expected, `julie(adult) / ${privacyScope}`)
  }
})

test('an adult can list a personal-scope Candidate they proxy-captured into a child\'s lane', async () => {
  const { service } = buildService()
  const jay = viewerFor('jay')
  await service.capture(jay, {
    personId: 'jayden',
    privacyScope: 'personal',
    kind: 'want',
    statedText: 'jayden wants a new bike helmet',
    source: 'human',
    propose: { mode: 'physical' },
  })

  const asJay = await service.listCandidates(jay, { personId: 'jayden' })
  assert.equal(asJay.length, 1)
  assert.equal(asJay[0].privacyScope, 'personal')

  // Any adult in the household may read a child's lane's personal scope, not just whoever
  // proxy-captured it — the rule keys off the child's access, not the capturing adult's identity.
  const asJulie = await service.listCandidates(viewerFor('julie'), { personId: 'jayden' })
  assert.equal(asJulie.length, 1)

  // But jayden's personal item stays invisible in another *adult's* lane read by a third adult —
  // only a child-owned lane grants the extra `personal` scope.
  await service.capture(viewerFor('julie'), {
    privacyScope: 'personal',
    kind: 'want',
    statedText: 'julie personal want',
    source: 'human',
    propose: { mode: 'digital' },
  })
  const jayOnJulie = await service.listCandidates(jay, { personId: 'julie' })
  assert.equal(jayOnJulie.length, 0)
})

// ---- capture ----

test('capture stores an event in the viewer\'s own lane', async () => {
  const { service } = buildService()
  const result = await service.capture(viewerFor('julie'), {
    privacyScope: 'family',
    kind: 'want',
    statedText: '주말에 자전거 타고 싶어',
    source: 'human',
  })
  assert.equal(result.capture.personId, 'julie')
  assert.equal(result.capture.capturedBy, 'julie')
  assert.equal(result.candidate, undefined)
})

test('an adult can capture into a child\'s lane', async () => {
  const { service } = buildService()
  const result = await service.capture(viewerFor('jay'), {
    personId: 'jayden',
    privacyScope: 'family',
    kind: 'want',
    statedText: 'wants a new bike helmet',
    source: 'human',
  })
  assert.equal(result.capture.personId, 'jayden')
  assert.equal(result.capture.capturedBy, 'jay')
})

test('an adult cannot capture into another adult\'s lane', async () => {
  const { service } = buildService()
  await expectHttp(
    service.capture(viewerFor('jay'), {
      personId: 'julie',
      privacyScope: 'family',
      kind: 'want',
      statedText: 'anything',
      source: 'human',
    }),
    { status: 403, code: 'LANE_MISMATCH' },
  )
})

test('capturing into an unknown personId fails as LANE_MISMATCH, not a crash', async () => {
  const { service } = buildService()
  await expectHttp(
    service.capture(viewerFor('jay'), {
      personId: 'ghost',
      privacyScope: 'family',
      kind: 'want',
      statedText: 'anything',
      source: 'human',
    }),
    { status: 403, code: 'LANE_MISMATCH' },
  )
})

test('a child cannot record a professional-scope capture, even in their own lane', async () => {
  const { service } = buildService()
  await expectHttp(
    service.capture(viewerFor('jayden'), {
      privacyScope: 'professional',
      kind: 'want',
      statedText: 'anything',
      source: 'human',
    }),
    { status: 403, code: 'PRIVACY_SCOPE_DENIED' },
  )
})

test('an empty or whitespace-only statedText is rejected', async () => {
  const { service } = buildService()
  await expectHttp(
    service.capture(viewerFor('julie'), { privacyScope: 'personal', kind: 'fact', statedText: '   ', source: 'human' }),
    { status: 400, code: 'CAPTURE_TEXT_INVALID' },
  )
})

test('a statedText over 2000 characters is rejected', async () => {
  const { service } = buildService()
  await expectHttp(
    service.capture(viewerFor('julie'), {
      privacyScope: 'personal',
      kind: 'fact',
      statedText: 'x'.repeat(2001),
      source: 'human',
    }),
    { status: 400, code: 'CAPTURE_TEXT_INVALID' },
  )
})

test('capturedBy is always forced to the viewer, even if the caller tries to spoof it', async () => {
  const { service } = buildService()
  const result = await service.capture(viewerFor('jay'), {
    personId: 'jayden',
    privacyScope: 'family',
    kind: 'fact',
    statedText: 'Jayden has a dentist appointment',
    source: 'human',
    capturedBy: 'jayden',
  })
  assert.equal(result.capture.capturedBy, 'jay')
})

test('propose creates a Candidate tied back to its Capture, proposed by the viewer', async () => {
  const { service } = buildService()
  const result = await service.capture(viewerFor('julie'), {
    privacyScope: 'family',
    kind: 'want',
    statedText: '주말에 자전거 타고 싶어',
    source: 'human',
    propose: { mode: 'physical', estimatedMinutes: 60, priority: 'medium' },
  })
  assert.ok(result.candidate)
  assert.equal(result.candidate.sourceCaptureId, result.capture.id)
  assert.equal(result.candidate.proposedBy, 'julie')
  assert.equal(result.candidate.opportunity.mode, 'physical')
  assert.equal(result.candidate.opportunity.proposedBy, 'julie')
  assert.equal(result.candidate.version, 1)
})

test('proposing from a non-actionable capture kind is a 400', async () => {
  const { service } = buildService()
  await expectHttp(
    service.capture(viewerFor('julie'), {
      privacyScope: 'family',
      kind: 'fact',
      statedText: 'a plain fact',
      source: 'human',
      propose: { mode: 'physical' },
    }),
    { status: 400, code: 'CAPTURE_KIND_NOT_ACTIONABLE' },
  )
})

// ---- listCandidates ----

test('listCandidates for another adult\'s lane shows only family-scope candidates', async () => {
  const { service } = buildService()
  const julie = viewerFor('julie')
  await service.capture(julie, {
    privacyScope: 'family',
    kind: 'want',
    statedText: 'family want',
    source: 'human',
    propose: { mode: 'physical' },
  })
  await service.capture(julie, {
    privacyScope: 'personal',
    kind: 'want',
    statedText: 'personal want',
    source: 'human',
    propose: { mode: 'physical' },
  })
  await service.capture(julie, {
    privacyScope: 'professional',
    kind: 'want',
    statedText: 'work want',
    source: 'human',
    propose: { mode: 'digital' },
  })

  const asJay = await service.listCandidates(viewerFor('jay'), { personId: 'julie' })
  assert.equal(asJay.length, 1)
  assert.equal(asJay[0].privacyScope, 'family')
  assert.equal(asJay[0].state, 'proposed')

  const asJulie = await service.listCandidates(julie, { personId: 'julie' })
  assert.equal(asJulie.length, 3)
})

// ---- decideCandidate ----

test('Julie\'s professional candidate is invisible to Jay by id — 404, never 403', async () => {
  const { service } = buildService()
  const julie = viewerFor('julie')
  const { candidate } = await service.capture(julie, {
    privacyScope: 'professional',
    kind: 'want',
    statedText: 'work only',
    source: 'human',
    propose: { mode: 'digital' },
  })

  await expectHttp(
    service.decideCandidate(viewerFor('jay'), {
      candidateId: candidate.id,
      personId: 'julie',
      kind: 'accept',
      expectedVersion: 1,
    }),
    { status: 404, code: 'CANDIDATE_NOT_FOUND' },
  )
})

test('an adult cannot decide another adult\'s family-scope candidate', async () => {
  const { service } = buildService()
  const julie = viewerFor('julie')
  const { candidate } = await service.capture(julie, {
    privacyScope: 'family',
    kind: 'want',
    statedText: 'family want',
    source: 'human',
    propose: { mode: 'physical' },
  })

  await expectHttp(
    service.decideCandidate(viewerFor('jay'), {
      candidateId: candidate.id,
      personId: 'julie',
      kind: 'accept',
      expectedVersion: 1,
    }),
    { status: 403, code: 'DECISION_NOT_ALLOWED' },
  )
})

test('an adult may decide a child\'s candidate, and the decision is recorded as the adult\'s', async () => {
  const { service } = buildService()
  const jay = viewerFor('jay')
  const { candidate } = await service.capture(jay, {
    personId: 'jayden',
    privacyScope: 'family',
    kind: 'want',
    statedText: 'jayden wants a bike',
    source: 'human',
    propose: { mode: 'physical' },
  })

  const result = await service.decideCandidate(jay, {
    candidateId: candidate.id,
    personId: 'jayden',
    kind: 'accept',
    expectedVersion: 1,
    by: 'jayden', // ignored — the service always uses the viewer's own personId
  })

  assert.equal(result.candidate.decision.by, 'jay')
  assert.ok(result.task)
  assert.deepEqual(result.task.block.people.physicalOwnerIds, ['jayden'])
})

test('accepting a Candidate creates a human-executed Task — no chad executor in A3', async () => {
  const { service } = buildService()
  const julie = viewerFor('julie')
  const { candidate } = await service.capture(julie, {
    privacyScope: 'family',
    kind: 'want',
    statedText: 'ride bikes',
    source: 'human',
    propose: { mode: 'physical', estimatedMinutes: 45 },
  })

  const result = await service.decideCandidate(julie, {
    candidateId: candidate.id,
    personId: 'julie',
    kind: 'accept',
    expectedVersion: 1,
  })

  assert.ok(result.task)
  assert.equal(result.task.block.digital.executor, undefined)
  assert.deepEqual(result.task.block.people.physicalOwnerIds, ['julie'])
  assert.equal(result.task.workState, 'open')
  assert.equal(result.task.privacyScope, 'family')
  assert.equal(result.candidate.decision.kind, 'accept')
  assert.equal(result.candidate.decision.by, 'julie')
})

test('declining a Candidate never creates a Task', async () => {
  const { service } = buildService()
  const julie = viewerFor('julie')
  const { candidate } = await service.capture(julie, {
    privacyScope: 'family',
    kind: 'want',
    statedText: 'ride bikes',
    source: 'human',
    propose: { mode: 'physical' },
  })

  const result = await service.decideCandidate(julie, {
    candidateId: candidate.id,
    personId: 'julie',
    kind: 'decline',
    expectedVersion: 1,
  })
  assert.equal(result.task, undefined)
  assert.equal(result.candidate.decision.kind, 'decline')
})

test('deciding an already-decided Candidate is a 409', async () => {
  const { service } = buildService()
  const julie = viewerFor('julie')
  const { candidate } = await service.capture(julie, {
    privacyScope: 'family',
    kind: 'want',
    statedText: 'ride bikes',
    source: 'human',
    propose: { mode: 'physical' },
  })
  await service.decideCandidate(julie, { candidateId: candidate.id, personId: 'julie', kind: 'accept', expectedVersion: 1 })

  await expectHttp(
    service.decideCandidate(julie, { candidateId: candidate.id, personId: 'julie', kind: 'accept', expectedVersion: 2 }),
    { status: 409, code: 'CANDIDATE_ALREADY_DECIDED' },
  )
})

test('a stale expectedVersion on decide is a 409 VERSION_CONFLICT', async () => {
  const { service } = buildService()
  const julie = viewerFor('julie')
  const { candidate } = await service.capture(julie, {
    privacyScope: 'family',
    kind: 'want',
    statedText: 'ride bikes',
    source: 'human',
    propose: { mode: 'physical' },
  })

  await expectHttp(
    service.decideCandidate(julie, { candidateId: candidate.id, personId: 'julie', kind: 'accept', expectedVersion: 99 }),
    { status: 409, code: 'VERSION_CONFLICT' },
  )
})

// ---- transitionTask ----

test('transitioning open -> in_progress -> done requires readback evidence on done', async () => {
  const { service } = buildService()
  const julie = viewerFor('julie')
  const { candidate } = await service.capture(julie, {
    privacyScope: 'family',
    kind: 'want',
    statedText: 'ride bikes',
    source: 'human',
    propose: { mode: 'physical' },
  })
  const { task } = await service.decideCandidate(julie, {
    candidateId: candidate.id,
    personId: 'julie',
    kind: 'accept',
    expectedVersion: 1,
  })

  const inProgress = await service.transitionTask(julie, {
    taskId: task.id,
    personId: 'julie',
    next: 'in_progress',
    expectedVersion: 1,
  })
  assert.equal(inProgress.task.workState, 'in_progress')

  await expectHttp(
    service.transitionTask(julie, { taskId: task.id, personId: 'julie', next: 'done', expectedVersion: 2 }),
    { status: 400, code: 'READBACK_EVIDENCE_REQUIRED' },
  )

  const done = await service.transitionTask(julie, {
    taskId: task.id,
    personId: 'julie',
    next: 'done',
    readbackEvidenceRefs: ['ev-done'],
    expectedVersion: 2,
  })
  assert.equal(done.task.workState, 'done')
})

test('a wrong-actor task transition is DECISION_NOT_ALLOWED', async () => {
  const { service } = buildService()
  const julie = viewerFor('julie')
  const { candidate } = await service.capture(julie, {
    privacyScope: 'family',
    kind: 'want',
    statedText: 'ride bikes',
    source: 'human',
    propose: { mode: 'physical' },
  })
  const { task } = await service.decideCandidate(julie, {
    candidateId: candidate.id,
    personId: 'julie',
    kind: 'accept',
    expectedVersion: 1,
  })

  await expectHttp(
    service.transitionTask(viewerFor('jay'), { taskId: task.id, personId: 'julie', next: 'in_progress', expectedVersion: 1 }),
    { status: 403, code: 'DECISION_NOT_ALLOWED' },
  )
})

test('an unknown taskId in the viewer\'s own lane is TASK_NOT_FOUND', async () => {
  const { service } = buildService()
  await expectHttp(
    service.transitionTask(viewerFor('julie'), {
      taskId: 'does-not-exist',
      personId: 'julie',
      next: 'in_progress',
      expectedVersion: 1,
    }),
    { status: 404, code: 'TASK_NOT_FOUND' },
  )
})

// ---- listFamilyTasks ----

test('listFamilyTasks contains only family-scope tasks, across every lane', async () => {
  const { service } = buildService()
  const julie = viewerFor('julie')
  const jay = viewerFor('jay')

  const familyCandidate = await service.capture(julie, {
    privacyScope: 'family',
    kind: 'want',
    statedText: 'family task',
    source: 'human',
    propose: { mode: 'physical' },
  })
  await service.decideCandidate(julie, { candidateId: familyCandidate.candidate.id, personId: 'julie', kind: 'accept', expectedVersion: 1 })

  const personalCandidate = await service.capture(jay, {
    privacyScope: 'personal',
    kind: 'want',
    statedText: 'personal task',
    source: 'human',
    propose: { mode: 'digital' },
  })
  await service.decideCandidate(jay, { candidateId: personalCandidate.candidate.id, personId: 'jay', kind: 'accept', expectedVersion: 1 })

  const professionalCandidate = await service.capture(jay, {
    privacyScope: 'professional',
    kind: 'want',
    statedText: 'work task',
    source: 'human',
    propose: { mode: 'digital' },
  })
  await service.decideCandidate(jay, {
    candidateId: professionalCandidate.candidate.id,
    personId: 'jay',
    kind: 'accept',
    expectedVersion: 1,
  })

  const familyTasks = await service.listFamilyTasks(julie, {})
  assert.equal(familyTasks.length, 1)
  assert.ok(familyTasks.every((task) => task.privacyScope === 'family'))
})

test('listTasks applies the same double read-authorization boundary as listCandidates', async () => {
  const { service } = buildService()
  const julie = viewerFor('julie')

  const familyCandidate = await service.capture(julie, {
    privacyScope: 'family',
    kind: 'want',
    statedText: 'family task',
    source: 'human',
    propose: { mode: 'physical' },
  })
  await service.decideCandidate(julie, { candidateId: familyCandidate.candidate.id, personId: 'julie', kind: 'accept', expectedVersion: 1 })

  const personalCandidate = await service.capture(julie, {
    privacyScope: 'personal',
    kind: 'want',
    statedText: 'personal task',
    source: 'human',
    propose: { mode: 'physical' },
  })
  await service.decideCandidate(julie, { candidateId: personalCandidate.candidate.id, personId: 'julie', kind: 'accept', expectedVersion: 1 })

  const asJay = await service.listTasks(viewerFor('jay'), { personId: 'julie' })
  assert.equal(asJay.length, 1)
  assert.equal(asJay[0].privacyScope, 'family')

  const asChild = await service.listTasks(viewerFor('jayden'), { personId: 'julie' })
  assert.equal(asChild.length, 0)
})

// ---- listFamilyTasks: defense-in-depth read-authorization for the viewer itself ----

test('listFamilyTasks applies the read-authorization boundary to the viewer too — a child sees none of the adults\' family tasks', async () => {
  const { service } = buildService()
  const jay = viewerFor('jay')
  const julie = viewerFor('julie')

  const jayCandidate = await service.capture(jay, {
    privacyScope: 'family',
    kind: 'want',
    statedText: 'jay family task',
    source: 'human',
    propose: { mode: 'physical' },
  })
  await service.decideCandidate(jay, { candidateId: jayCandidate.candidate.id, personId: 'jay', kind: 'accept', expectedVersion: 1 })

  const julieCandidate = await service.capture(julie, {
    privacyScope: 'family',
    kind: 'want',
    statedText: 'julie family task',
    source: 'human',
    propose: { mode: 'physical' },
  })
  await service.decideCandidate(julie, { candidateId: julieCandidate.candidate.id, personId: 'julie', kind: 'accept', expectedVersion: 1 })

  const asAdult = await service.listFamilyTasks(jay, {})
  assert.equal(asAdult.length, 2)

  const asChild = await service.listFamilyTasks(viewerFor('jayden'), {})
  assert.deepEqual(asChild, [])
})

// ---- decideCandidate: atomic accept + self-healing ----

test('accept is atomic: the accepted candidate and its task exist together, never one without the other', async () => {
  const { service, store } = buildService()
  const julie = viewerFor('julie')
  const { candidate } = await service.capture(julie, {
    privacyScope: 'family',
    kind: 'want',
    statedText: 'ride bikes',
    source: 'human',
    propose: { mode: 'physical' },
  })

  const result = await service.decideCandidate(julie, {
    candidateId: candidate.id,
    personId: 'julie',
    kind: 'accept',
    expectedVersion: 1,
  })

  assert.equal(result.repaired, undefined)
  const persistedTask = await store.getTaskByCandidateId({ candidateId: candidate.id, personId: 'julie', scopes: ['family'] })
  assert.equal(persistedTask.id, result.task.id)
})

test('decideCandidate self-heals an already-accepted Candidate that has no Task on record', async () => {
  const { service, store } = buildService()
  const julie = viewerFor('julie')

  const decision = {
    by: 'julie',
    at: '2026-09-08T10:00:01.000Z',
    kind: 'accept',
    evidenceRef: 'human:decision:cand-legacy:2026-09-08T10:00:01.000Z',
  }
  const opportunity = {
    id: 'cand-legacy',
    ownerId: 'julie',
    title: 'legacy accepted candidate',
    mode: 'physical',
    evidenceRefs: [],
    privacyScope: 'family',
    decision,
  }
  await store.insertCandidate({
    id: 'cand-legacy',
    personId: 'julie',
    privacyScope: 'family',
    proposedBy: 'julie',
    opportunity,
    decision,
    version: 1,
    createdAt: '2026-09-08T10:00:00.000Z',
    updatedAt: '2026-09-08T10:00:01.000Z',
  })
  // Deliberately no task inserted — simulates data from before atomic acceptCandidate existed.

  const result = await service.decideCandidate(julie, {
    candidateId: 'cand-legacy',
    personId: 'julie',
    kind: 'accept', // irrelevant here — an existing decision short-circuits straight to repair
    expectedVersion: 1,
  })

  assert.equal(result.repaired, true)
  assert.ok(result.task)
  assert.equal(result.task.candidateId, 'cand-legacy')
  assert.equal(result.candidate.decision.by, 'julie') // untouched — still the original decision
  assert.equal(result.candidate.version, 1) // the candidate row itself was never rewritten

  const persistedTask = await store.getTaskByCandidateId({ candidateId: 'cand-legacy', personId: 'julie', scopes: ['family'] })
  assert.ok(persistedTask)
})

test('decideCandidate does not repair — and returns the normal 409 — when a Task already exists for an accepted Candidate', async () => {
  const { service } = buildService()
  const julie = viewerFor('julie')
  const { candidate } = await service.capture(julie, {
    privacyScope: 'family',
    kind: 'want',
    statedText: 'ride bikes',
    source: 'human',
    propose: { mode: 'physical' },
  })
  await service.decideCandidate(julie, { candidateId: candidate.id, personId: 'julie', kind: 'accept', expectedVersion: 1 })

  await expectHttp(
    service.decideCandidate(julie, { candidateId: candidate.id, personId: 'julie', kind: 'accept', expectedVersion: 2 }),
    { status: 409, code: 'CANDIDATE_ALREADY_DECIDED' },
  )
})
