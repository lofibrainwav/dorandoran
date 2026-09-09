import test from 'node:test'
import assert from 'node:assert/strict'

import {
  decideCandidate,
  deriveCandidateState,
  jobModeLabel,
  proposeCandidate,
  taskFromAcceptedCandidate,
} from '../../lib/family-os/index.ts'

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

test('want/decision/final_artifact captures become candidates; fact/question do not', () => {
  for (const kind of ['want', 'decision', 'final_artifact']) {
    const candidate = proposeCandidate({
      capture: capture({ kind }),
      proposedBy: 'julie',
      id: `cand-${kind}`,
      mode: 'physical',
    })
    assert.equal(candidate.ownerId, 'julie')
    assert.equal(candidate.sourceCaptureId, 'cap-1')
    assert.equal(candidate.title, capture().statedText)
  }

  for (const kind of ['fact', 'question']) {
    assert.throws(
      () => proposeCandidate({ capture: capture({ kind }), proposedBy: 'julie', id: 'cand-x', mode: 'physical' }),
      /CAPTURE_KIND_NOT_ACTIONABLE/,
    )
  }
})

test('candidate privacy scope inherits from capture and is never widened', () => {
  const professional = proposeCandidate({
    capture: capture({ privacyScope: 'professional' }),
    proposedBy: 'julie',
    id: 'cand-pro',
    mode: 'digital',
  })
  assert.equal(professional.privacyScope, 'professional')

  const personal = proposeCandidate({
    capture: capture({ privacyScope: 'personal' }),
    proposedBy: 'julie',
    id: 'cand-personal',
    mode: 'digital',
  })
  assert.equal(personal.privacyScope, 'personal')
})

test('an explicit title overrides the capture statedText default', () => {
  const candidate = proposeCandidate({
    capture: capture(),
    proposedBy: 'julie',
    id: 'cand-titled',
    mode: 'physical',
    title: '자전거 라이딩',
  })
  assert.equal(candidate.title, '자전거 라이딩')
})

function candidate(overrides = {}) {
  return {
    id: 'cand-1',
    ownerId: 'julie',
    title: 'Ride bikes',
    mode: 'physical',
    evidenceRefs: ['ev-capture-1'],
    sourceCaptureId: 'cap-1',
    proposedBy: 'julie',
    privacyScope: 'family',
    ...overrides,
  }
}

test('candidate state is derived: proposed by default, then accepted/declined from decision', () => {
  const created = '2026-09-01T00:00:00.000Z'
  assert.equal(
    deriveCandidateState(candidate(), { nowIso: '2026-09-02T00:00:00.000Z', createdAtIso: created }),
    'proposed',
  )
  assert.equal(
    deriveCandidateState(
      candidate({ decision: { by: 'julie', at: created, kind: 'accept', evidenceRef: 'ev-decision' } }),
      { nowIso: '2026-09-02T00:00:00.000Z', createdAtIso: created },
    ),
    'accepted',
  )
  assert.equal(
    deriveCandidateState(
      candidate({ decision: { by: 'julie', at: created, kind: 'decline', evidenceRef: 'ev-decision' } }),
      { nowIso: '2026-09-02T00:00:00.000Z', createdAtIso: created },
    ),
    'declined',
  )
})

test('an undecided candidate expires after its ttl, defaulting to 14 days', () => {
  const created = '2026-09-01T00:00:00.000Z'
  assert.equal(
    deriveCandidateState(candidate(), { nowIso: '2026-09-10T00:00:00.000Z', createdAtIso: created }),
    'proposed',
  )
  assert.equal(
    deriveCandidateState(candidate(), { nowIso: '2026-09-20T00:00:00.000Z', createdAtIso: created }),
    'expired',
  )
  assert.equal(
    deriveCandidateState(candidate(), { nowIso: '2026-09-04T00:00:00.000Z', createdAtIso: created, ttlDays: 2 }),
    'expired',
  )
})

test('expiry boundary is inclusive: exactly createdAt + ttl is expired, one ms earlier is still proposed', () => {
  const created = '2026-09-01T00:00:00.000Z'
  const exactBoundary = new Date(Date.parse(created) + 2 * 24 * 60 * 60 * 1000).toISOString()
  const oneMsEarlier = new Date(Date.parse(created) + 2 * 24 * 60 * 60 * 1000 - 1).toISOString()
  assert.equal(
    deriveCandidateState(candidate(), { nowIso: exactBoundary, createdAtIso: created, ttlDays: 2 }),
    'expired',
  )
  assert.equal(
    deriveCandidateState(candidate(), { nowIso: oneMsEarlier, createdAtIso: created, ttlDays: 2 }),
    'proposed',
  )
})

test('an invalid ISO date for now or createdAt throws instead of silently comparing NaN', () => {
  assert.throws(
    () => deriveCandidateState(candidate(), { nowIso: 'not-a-date', createdAtIso: '2026-09-01T00:00:00.000Z' }),
    /ISO_DATE_INVALID/,
  )
  assert.throws(
    () => deriveCandidateState(candidate(), { nowIso: '2026-09-01T00:00:00.000Z', createdAtIso: 'not-a-date' }),
    /ISO_DATE_INVALID/,
  )
})

test('chad can never be the human who decides a candidate', () => {
  assert.throws(
    () => decideCandidate(candidate(), { by: 'chad', at: '2026-09-02T00:00:00.000Z', kind: 'accept', evidenceRef: 'ev-decision' }),
    /HUMAN_DECISION_REQUIRED/,
  )
  assert.throws(
    () => decideCandidate(candidate(), { by: '', at: '2026-09-02T00:00:00.000Z', kind: 'accept', evidenceRef: 'ev-decision' }),
    /HUMAN_DECISION_REQUIRED/,
  )
})

test('a candidate cannot be decided twice, and a decision needs its own evidence', () => {
  const decided = candidate({ decision: { by: 'julie', at: '2026-09-02T00:00:00.000Z', kind: 'accept', evidenceRef: 'ev-decision' } })
  assert.throws(
    () => decideCandidate(decided, { by: 'julie', at: '2026-09-03T00:00:00.000Z', kind: 'decline', evidenceRef: 'ev-2' }),
    /CANDIDATE_ALREADY_DECIDED/,
  )
  assert.throws(
    () => decideCandidate(candidate(), { by: 'julie', at: '2026-09-02T00:00:00.000Z', kind: 'accept', evidenceRef: '' }),
    /DECISION_EVIDENCE_REQUIRED/,
  )
})

test('deciding a candidate returns a new object and never mutates the original candidate', () => {
  const original = candidate()
  const decided = decideCandidate(original, { by: 'julie', at: '2026-09-02T00:00:00.000Z', kind: 'accept', evidenceRef: 'ev-decision' })
  assert.notEqual(decided, original)
  assert.equal(original.decision, undefined)
  assert.deepEqual(original, candidate())
  assert.deepEqual(decided.decision, { by: 'julie', at: '2026-09-02T00:00:00.000Z', kind: 'accept', evidenceRef: 'ev-decision' })
})

test('a task cannot be built from a candidate that was never accepted', () => {
  assert.throws(
    () => taskFromAcceptedCandidate(candidate(), { id: 'task-1', now: '2026-09-02T00:00:00.000Z' }),
    /CANDIDATE_NOT_ACCEPTED/,
  )
  const declined = candidate({ decision: { by: 'julie', at: '2026-09-02T00:00:00.000Z', kind: 'decline', evidenceRef: 'ev-decision' } })
  assert.throws(
    () => taskFromAcceptedCandidate(declined, { id: 'task-1', now: '2026-09-02T00:00:00.000Z' }),
    /CANDIDATE_NOT_ACCEPTED/,
  )
})

test('an accepted candidate becomes an open action Task carrying both evidence trails', () => {
  const accepted = candidate({
    estimatedMinutes: 45,
    priority: 'high',
    decision: { by: 'julie', at: '2026-09-02T00:00:00.000Z', kind: 'accept', evidenceRef: 'ev-decision' },
  })
  const task = taskFromAcceptedCandidate(accepted, {
    id: 'task-1',
    now: '2026-09-02T00:00:05.000Z',
    physicalOwnerIds: ['julie'],
  })
  assert.equal(task.type, 'action')
  assert.equal(task.workMode, 'physical')
  assert.equal(task.reality.title, 'Ride bikes')
  assert.equal(task.reality.durationMinutes, 45)
  assert.deepEqual(task.evidenceRefs, ['ev-capture-1', 'ev-decision'])
  assert.equal(task.evidenceState, 'unknown')
  assert.deepEqual(task.people, {
    subjectIds: ['julie'],
    physicalOwnerIds: ['julie'],
    approverIds: ['julie'],
    recipientIds: [],
  })
  assert.equal(task.workState, 'open')
  assert.equal(task.candidateId, 'cand-1')
  assert.equal(task.privacyScope, 'family')
  assert.equal(task.timeEngine.priority, 'high')
})

test('a professional candidate produces a professional task: privacy is never widened at the Candidate to Task hop', () => {
  const accepted = candidate({
    privacyScope: 'professional',
    decision: { by: 'julie', at: '2026-09-02T00:00:00.000Z', kind: 'accept', evidenceRef: 'ev-decision' },
  })
  const task = taskFromAcceptedCandidate(accepted, { id: 'task-professional', now: '2026-09-02T00:00:00.000Z' })
  assert.equal(task.privacyScope, 'professional')
})

test('jobModeLabel maps together to the Hybrid display label without touching stored data', () => {
  assert.equal(jobModeLabel('digital'), 'Digital')
  assert.equal(jobModeLabel('physical'), 'Physical')
  assert.equal(jobModeLabel('together'), 'Hybrid')

  const accepted = candidate({
    mode: 'together',
    decision: { by: 'julie', at: '2026-09-02T00:00:00.000Z', kind: 'accept', evidenceRef: 'ev-decision' },
  })
  const task = taskFromAcceptedCandidate(accepted, { id: 'task-together', now: '2026-09-02T00:00:00.000Z' })
  assert.equal(task.workMode, 'together')
  assert.equal(jobModeLabel(task.workMode), 'Hybrid')
})
