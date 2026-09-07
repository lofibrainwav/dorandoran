import test from 'node:test'
import assert from 'node:assert/strict'
import {
  completeHandoff,
  createHandoff,
  evaluateGoalClosure,
  shouldInterruptHuman,
  verifyHandoff,
} from '../../lib/family-os/index.ts'

test('recoverable unknown does not interrupt the human', () => {
  assert.equal(shouldInterruptHuman({
    recoverable: true,
    goalBlocked: true,
    authorityRequired: false,
    humanJudgmentRequired: false,
    lowPriority: false,
  }), 'silent_recover')
})

test('low-priority non-blocking ask is batched', () => {
  assert.equal(shouldInterruptHuman({
    recoverable: false,
    goalBlocked: false,
    authorityRequired: false,
    humanJudgmentRequired: true,
    lowPriority: true,
  }), 'batch')
})

test('authority needed to unblock goal asks now', () => {
  assert.equal(shouldInterruptHuman({
    recoverable: false,
    goalBlocked: true,
    authorityRequired: true,
    humanJudgmentRequired: false,
    lowPriority: false,
  }), 'ask_now')
})

test('handoff cannot verify without reality evidence', () => {
  const handoff = createHandoff({
    id: 'h1', goalId: 'g1', fromMode: 'digital', toMode: 'physical',
    description: 'Bring signed paper',
  })
  const completed = completeHandoff(handoff)
  assert.equal(completed.state, 'completed')
  assert.throws(() => verifyHandoff(completed, []), /HANDOFF_EVIDENCE_REQUIRED/)
})

test('verified required handoff can satisfy goal closure gate', () => {
  const handoff = verifyHandoff(completeHandoff(createHandoff({
    id: 'h1', goalId: 'g1', fromMode: 'digital', toMode: 'physical',
    description: 'Bring signed paper',
  })), ['e-handoff'])

  const goal = {
    id: 'g1', desiredOutcome: 'Paper delivered',
    successCriteria: [{ id: 'c1', description: 'Delivered', satisfied: true, evidenceRefs: ['e-delivery'] }],
    closureEvidenceRefs: ['e-delivery'],
    requiredHandoffIds: ['h1'],
  }

  assert.equal(evaluateGoalClosure(goal, [handoff]).goalComplete, true)
})

test('digital task completion does not close goal while required handoff is pending', () => {
  const handoff = createHandoff({
    id: 'h1', goalId: 'g1', fromMode: 'digital', toMode: 'physical',
    description: 'Parent signs form',
  })
  const goal = {
    id: 'g1', desiredOutcome: 'Registration complete',
    successCriteria: [{ id: 'c1', description: 'Form prepared', satisfied: true, evidenceRefs: ['e-form'] }],
    closureEvidenceRefs: ['e-form'],
    requiredHandoffIds: ['h1'],
  }
  const decision = evaluateGoalClosure(goal, [handoff])
  assert.equal(decision.goalComplete, false)
  assert.equal(decision.reason, 'REQUIRED_HANDOFFS_UNVERIFIED')
})
