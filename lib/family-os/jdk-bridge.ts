import type { LearningPracticeOutcomeV1, Opportunity, VerifiedLearningReleaseV1 } from './contracts.ts'

const FORBIDDEN_KEYS = new Set(['sourceRef', 'privateSource', 'truth', 'rawSource', 'rawEvidence', 'claims'])

function assertSafeProjection(value: unknown): void {
  if (!value || typeof value !== 'object') return
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key) || key.toLowerCase().startsWith('private')) {
      throw new Error('JDK_PRIVATE_TRUTH_LEAK')
    }
    assertSafeProjection(nested)
  }
}

export function projectLearningReleaseToOpportunity(input: {
  release: VerifiedLearningReleaseV1
  ownerId: string
}): Opportunity {
  assertSafeProjection(input.release)
  if (input.release.version !== 1 || input.release.releaseReady !== true) {
    throw new Error('JDK_RELEASE_NOT_VERIFIED')
  }
  return {
    id: `learning:${input.release.releaseId}`,
    ownerId: input.ownerId,
    title: input.release.title,
    mode: 'together',
    estimatedMinutes: input.release.estimatedMinutes,
    priority: 'medium',
    evidenceRefs: [...input.release.evidenceRefs],
  }
}

export function learningOutcomeIsValid(outcome: LearningPracticeOutcomeV1): boolean {
  assertSafeProjection(outcome)
  return outcome.version === 1 && outcome.evidenceRefs.length > 0
}
