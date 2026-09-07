import test from 'node:test'
import assert from 'node:assert/strict'
import { decideChadNextStep } from '../../lib/family-os/index.ts'

const autoCalendarGrant = {
  id: 'grant-1', subjectId: 'person-a', grantee: 'chad', domain: 'calendar',
  actions: ['read'], authority: 'auto', grantedBy: 'person-a', evidenceRef: 'e-grant',
  grantedAt: '2026-09-01T00:00:00.000Z',
}

test('authorized digital work can execute without human interruption', () => {
  const decision = decideChadNextStep({
    work: { chadCanExecuteDigital: true, requiresPhysicalAction: false, requiresHumanDecision: false, requiresHumanApproval: false },
    digitalAction: { capable: true, subjectId: 'person-a', domain: 'calendar', action: 'read', nowIso: '2026-09-06T20:00:00.000Z', grant: autoCalendarGrant },
    recoveryNeeded: false, recoveryAvailable: false, goalBlocked: false, lowPriority: false,
  })
  assert.equal(decision.workMode, 'digital')
  assert.equal(decision.nextStep, 'execute')
  assert.equal(decision.interruption, 'no_interrupt')
})

test('recoverable unknown recovers before asking', () => {
  const decision = decideChadNextStep({
    work: { chadCanExecuteDigital: true, requiresPhysicalAction: false, requiresHumanDecision: true, requiresHumanApproval: false },
    recoveryNeeded: true, recoveryAvailable: true, goalBlocked: true, lowPriority: false,
  })
  assert.equal(decision.nextStep, 'recover')
  assert.equal(decision.interruption, 'silent_recover')
})

test('human approval blocking the goal becomes Together and asks now', () => {
  const decision = decideChadNextStep({
    work: { chadCanExecuteDigital: true, requiresPhysicalAction: false, requiresHumanDecision: false, requiresHumanApproval: true },
    digitalAction: { capable: true, subjectId: 'person-a', domain: 'calendar', action: 'write', nowIso: '2026-09-06T20:00:00.000Z' },
    recoveryNeeded: false, recoveryAvailable: false, goalBlocked: true, lowPriority: false,
  })
  assert.equal(decision.workMode, 'together')
  assert.equal(decision.nextStep, 'ask')
  assert.equal(decision.interruption, 'ask_now')
})

test('physical action creates handoff path instead of false digital completion', () => {
  const decision = decideChadNextStep({
    work: { chadCanExecuteDigital: false, requiresPhysicalAction: true, requiresHumanDecision: false, requiresHumanApproval: false },
    recoveryNeeded: false, recoveryAvailable: false, goalBlocked: false, lowPriority: false,
  })
  assert.equal(decision.workMode, 'physical')
  assert.equal(decision.nextStep, 'handoff')
})

test('proven tight transition remains usable and does not force ask', () => {
  const decision = decideChadNextStep({
    work: { chadCanExecuteDigital: false, requiresPhysicalAction: true, requiresHumanDecision: false, requiresHumanApproval: false },
    recoveryNeeded: false, recoveryAvailable: false, goalBlocked: false, lowPriority: false,
    routeProfile: {
      scheduledGapMinutes: 15,
      liveTravelMinutes: 7,
      observedTravelMinutes: [6, 7, 8],
      preferredGapMinutes: 15,
      routineConfidence: 'high',
    },
  })
  assert.equal(decision.transition?.routineState, 'proven_tight_fit')
  assert.equal(decision.transition?.friction, 'low')
  assert.equal(decision.interruption, 'no_interrupt')
})
