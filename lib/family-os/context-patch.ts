import type { ContextPatch, RecoveryAttempt } from './contracts.ts'

export function createContextPatch(input: {
  goalId: string
  jobId: string
  missingField: string
  requestedFrom: string
  minimalQuestion: string
  resumePoint: string
  recoveryAttempts: RecoveryAttempt[]
}): ContextPatch {
  const recoveryWasAttempted = input.recoveryAttempts.length > 0
    && input.recoveryAttempts.every((attempt) => attempt.attempted || Boolean(attempt.unavailableReason))
  if (!recoveryWasAttempted) throw new Error('RECOVERY_REQUIRED_BEFORE_CONTEXT_PATCH')
  const evidence = input.recoveryAttempts.flatMap((attempt) => attempt.evidenceRefs)
  return {
    goalId: input.goalId,
    jobId: input.jobId,
    missingField: input.missingField,
    searchedEvidenceRefs: [...new Set(evidence)],
    minimalQuestion: input.minimalQuestion,
    resumePoint: input.resumePoint,
    state: 'needed',
  }
}
