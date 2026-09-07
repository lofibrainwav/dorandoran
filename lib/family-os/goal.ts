import type { GoalContract, HandoffContract, LearningPracticeOutcomeV1 } from './contracts.ts'

export type GoalClosureDecision = {
  goalComplete: boolean
  missingCriteria: string[]
  reason: string
}

export function evaluateGoalClosure(goal: GoalContract, handoffs: HandoffContract[] = []): GoalClosureDecision {
  const missingCriteria = goal.successCriteria
    .filter((criterion) => !criterion.satisfied || criterion.evidenceRefs.length === 0)
    .map((criterion) => criterion.id)

  if (missingCriteria.length) return { goalComplete: false, missingCriteria, reason: 'SUCCESS_CRITERIA_UNSATISFIED' }
  const requiredHandoffs = goal.requiredHandoffIds ?? []
  if (requiredHandoffs.some((id) => handoffs.find((handoff) => handoff.id === id)?.state !== 'verified')) {
    return { goalComplete: false, missingCriteria: [], reason: 'REQUIRED_HANDOFFS_UNVERIFIED' }
  }
  if (goal.closureEvidenceRefs.length === 0) {
    return { goalComplete: false, missingCriteria: [], reason: 'REALITY_READBACK_MISSING' }
  }
  return { goalComplete: true, missingCriteria: [], reason: 'VERIFIED_COMPLETE' }
}

export function applyLearningOutcomeReadback(
  goal: GoalContract,
  criterionId: string,
  outcome: LearningPracticeOutcomeV1,
): GoalContract {
  if (!outcome.verifierPassed || outcome.evidenceRefs.length === 0) return structuredClone(goal)
  const next = structuredClone(goal)
  const criterion = next.successCriteria.find((item) => item.id === criterionId)
  if (!criterion) throw new Error('GOAL_CRITERION_NOT_FOUND')
  criterion.satisfied = true
  criterion.evidenceRefs = [...new Set([...criterion.evidenceRefs, ...outcome.evidenceRefs])]
  next.closureEvidenceRefs = [...new Set([...next.closureEvidenceRefs, ...outcome.evidenceRefs])]
  return next
}
