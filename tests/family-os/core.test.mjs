import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyLearningOutcomeReadback,
  assessTransition,
  createContextPatch,
  evaluateGoalClosure,
  projectLearningReleaseToOpportunity,
  rankNextBestBlockOptions,
  reconcileEvidence,
  resolveAuthority,
  resolveCalendarMutation,
  resolveSpecificActorIdentity,
} from '../../lib/family-os/index.ts'

const now = '2026-09-06T20:00:00.000Z'

function grant(overrides = {}) {
  return {
    id: 'grant-1', subjectId: 'parent-a', grantee: 'chad', domain: 'gmail',
    actions: ['read', 'search'], authority: 'auto', grantedBy: 'parent-a',
    evidenceRef: 'ev-grant', grantedAt: '2026-09-01T00:00:00.000Z', ...overrides,
  }
}

test('capability does not create authority and read does not imply send', () => {
  assert.equal(resolveAuthority({ capable: true, subjectId: 'parent-a', domain: 'gmail', action: 'send', nowIso: now }).state, 'gate_required')
  assert.equal(resolveAuthority({ capable: true, subjectId: 'parent-a', domain: 'gmail', action: 'send', nowIso: now, grant: grant() }).state, 'gate_required')
  assert.equal(resolveAuthority({ capable: true, subjectId: 'parent-a', domain: 'gmail', action: 'read', nowIso: now, grant: grant() }).state, 'auto')
  assert.equal(resolveAuthority({ capable: false, subjectId: 'parent-a', domain: 'gmail', action: 'read', nowIso: now, grant: grant() }).state, 'blocked')
})

test('revoked or expired grants cannot authorize mutation', () => {
  assert.equal(resolveAuthority({ capable: true, subjectId: 'parent-a', domain: 'gmail', action: 'read', nowIso: now, grant: grant({ revokedAt: now }) }).state, 'gate_required')
  assert.equal(resolveAuthority({ capable: true, subjectId: 'parent-a', domain: 'gmail', action: 'read', nowIso: now, grant: grant({ expiresAt: '2026-09-01T00:00:00.000Z' }) }).state, 'gate_required')
})

test('UNKNOWN evidence remains UNKNOWN, not risk or confirmed', () => {
  assert.equal(reconcileEvidence([]), 'unknown')
  assert.equal(reconcileEvidence([{ id: 'e1', sourceType: 'map', observedAt: now, state: 'unknown' }]), 'unknown')
})

test('a 15-minute proven family transition can be tight without being friction', () => {
  const result = assessTransition({
    scheduledGapMinutes: 15,
    baselineTravelMinutes: { min: 5, max: 8 },
    observedTravelMinutes: [6, 7, 5, 7],
    preferredGapMinutes: 15,
    routineConfidence: 'high',
  })
  assert.equal(result.tightness, 'high')
  assert.equal(result.friction, 'low')
  assert.equal(result.routineState, 'proven_tight_fit')
})

test('live map deviation can turn a proven routine into real friction', () => {
  const result = assessTransition({
    scheduledGapMinutes: 15,
    liveTravelMinutes: 18,
    baselineTravelMinutes: { min: 5, max: 8 },
    observedTravelMinutes: [6, 7, 5],
    preferredGapMinutes: 15,
    routineConfidence: 'high',
  })
  assert.equal(result.friction, 'high')
  assert.equal(result.deviation, 'meaningful')
  assert.equal(result.routineState, 'friction')
})

test('ContextPatch is forbidden until authorized recovery was attempted or unavailable', () => {
  const common = { goalId: 'g1', jobId: 'j1', missingField: 'pianoTeacherEmail', requestedFrom: 'parent-a', minimalQuestion: '제가 확인 가능한 메일·캘린더·연락처에는 주소가 없어요. 이메일 주소만 알려주실 수 있나요?', resumePoint: 'SEND_EMAIL' }
  assert.throws(() => createContextPatch({ ...common, recoveryAttempts: [] }), /RECOVERY_REQUIRED/)
  const patch = createContextPatch({ ...common, recoveryAttempts: [
    { source: 'authorized-gmail', attempted: true, evidenceRefs: ['e-mail-search'] },
    { source: 'calendar', attempted: true, evidenceRefs: ['e-cal-search'] },
    { source: 'contacts', attempted: false, unavailableReason: 'connector-not-authorized', evidenceRefs: [] },
  ] })
  assert.equal(patch.missingField, 'pianoTeacherEmail')
  assert.equal(patch.resumePoint, 'SEND_EMAIL')
  assert.deepEqual(patch.searchedEvidenceRefs, ['e-mail-search', 'e-cal-search'])
})

test('task completion cannot close a goal without success criteria and reality readback', () => {
  const goal = { id: 'g1', desiredOutcome: 'Jayden completes verified practice', successCriteria: [{ id: 'practice', description: 'Practice verified', satisfied: true, evidenceRefs: ['task-complete'] }], closureEvidenceRefs: [] }
  assert.equal(evaluateGoalClosure(goal).goalComplete, false)
  const next = { ...goal, closureEvidenceRefs: ['verifier-readback'] }
  assert.equal(evaluateGoalClosure(next).goalComplete, true)
})

test('JDK verified release becomes a Together opportunity but does not itself close Family goal', () => {
  const release = { version: 1, releaseId: 'r1', taskId: 't1', title: 'Volume practice', verifiedAt: now, releaseReady: true, estimatedMinutes: 20, evidenceRefs: ['release-receipt'] }
  const opportunity = projectLearningReleaseToOpportunity({ release, ownerId: 'learner' })
  assert.equal(opportunity.mode, 'together')
  assert.equal(opportunity.ownerId, 'learner')
  const goal = { id: 'g1', desiredOutcome: 'Complete practice', successCriteria: [{ id: 'done', description: 'verified outcome', satisfied: false, evidenceRefs: [] }], closureEvidenceRefs: [] }
  assert.equal(evaluateGoalClosure(goal).goalComplete, false)
})

test('JDK private truth cannot leak through bridge projection', () => {
  const unsafe = { version: 1, releaseId: 'r1', taskId: 't1', title: 'Practice', verifiedAt: now, releaseReady: true, evidenceRefs: [], privateSource: { sourceRef: 'private://x' } }
  assert.throws(() => projectLearningReleaseToOpportunity({ release: unsafe, ownerId: 'learner' }), /JDK_PRIVATE_TRUTH_LEAK/)
})

test('JDK outcome readback can satisfy a criterion only when verifier evidence exists', () => {
  const goal = { id: 'g1', desiredOutcome: 'Practice', successCriteria: [{ id: 'done', description: 'Verified', satisfied: false, evidenceRefs: [] }], closureEvidenceRefs: [] }
  const unchanged = applyLearningOutcomeReadback(goal, 'done', { version: 1, releaseId: 'r1', verifierPassed: false, observedAt: now, evidenceRefs: ['e1'] })
  assert.equal(unchanged.successCriteria[0].satisfied, false)
  const next = applyLearningOutcomeReadback(goal, 'done', { version: 1, releaseId: 'r1', verifierPassed: true, observedAt: now, evidenceRefs: ['e-verifier'] })
  assert.equal(next.successCriteria[0].satisfied, true)
  assert.deepEqual(next.closureEvidenceRefs, ['e-verifier'])
})

test('generic JDK parent actor never becomes a specific family identity without an explicit mapping', () => {
  const allowed = ['parent-a', 'parent-b']
  assert.equal(resolveSpecificActorIdentity('parent', allowed), null)
  assert.equal(resolveSpecificActorIdentity('parent-a', allowed), 'parent-a')
})

test('protected calendar blocks cannot be moved silently by Chad', () => {
  assert.deepEqual(resolveCalendarMutation({ isProtected: true, actor: 'chad_auto', operation: 'move' }), { allowed: false, gateRequired: false, reason: 'PROTECTED_BLOCK_AUTO_MUTATION_DENIED' })
  assert.equal(resolveCalendarMutation({ isProtected: true, actor: 'human', operation: 'move' }).gateRequired, true)
})

test('Next Best Block filters impossible options and returns multiple user choices', () => {
  const options = rankNextBestBlockOptions([
    { id: 'quick', ownerId: 'person-a', title: 'Family email cleanup', mode: 'digital', estimatedMinutes: 20, priority: 'medium', interest: 'medium', growthValue: 'low', requiredTools: ['mac'], evidenceRefs: ['e1'] },
    { id: 'important', ownerId: 'person-a', title: 'Resume update', mode: 'together', estimatedMinutes: 40, priority: 'high', interest: 'medium', growthValue: 'medium', requiredTools: ['mac'], evidenceRefs: ['e2'] },
    { id: 'too-long', ownerId: 'person-a', title: 'Deep project', mode: 'together', estimatedMinutes: 90, priority: 'high', interest: 'high', growthValue: 'high', requiredTools: ['mac'], evidenceRefs: ['e3'] },
    { id: 'growth', ownerId: 'person-a', title: 'AI audio prototype', mode: 'together', estimatedMinutes: 35, priority: 'medium', interest: 'high', growthValue: 'high', requiredTools: ['mac'], evidenceRefs: ['e4'] },
  ], { personId: 'person-a', availableMinutes: 45, currentLocation: 'home', energy: 'high', availableTools: ['mac'], evidenceRefs: ['capacity-now'] })
  assert.equal(options.length, 3)
  assert.equal(options.some((o) => o.opportunityId === 'too-long'), false)
  assert.equal(options[0].opportunityId, 'important')
})
