import type { Opportunity } from './contracts.ts'

export interface JdkVerifiedLearningReleaseProjection {
  task: {
    id: string
    subject: string
    conceptId: string
    context?: string
    prompt: string
    responseSpec: unknown
    learningNeeds: unknown
    metadata?: unknown
  }
  plan: {
    id: string
    taskId: string
    adapterId: string
    steps: unknown[]
  }
  rendererId: string
  verifiedAt: string
}

function requiredText(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code)
  return value.trim()
}

export function adaptJdkVerifiedLearningRelease(
  release: JdkVerifiedLearningReleaseProjection,
  ownerId: string,
): Opportunity {
  const taskId = requiredText(release?.task?.id, 'JDK_RELEASE_TASK_ID_INVALID')
  const prompt = requiredText(release?.task?.prompt, 'JDK_RELEASE_PROMPT_INVALID')
  requiredText(release?.rendererId, 'JDK_RELEASE_RENDERER_INVALID')
  requiredText(ownerId, 'JDK_RELEASE_OWNER_INVALID')

  if (!Number.isFinite(Date.parse(release?.verifiedAt))) {
    throw new Error('JDK_RELEASE_VERIFICATION_TIME_INVALID')
  }
  if (release?.plan?.taskId && release.plan.taskId !== taskId) {
    throw new Error('JDK_RELEASE_PLAN_TASK_MISMATCH')
  }

  const receipt = `jdk-release:${taskId}:${release.verifiedAt}`
  return {
    id: `learning:${taskId}:${release.verifiedAt}`,
    ownerId: ownerId.trim(),
    title: prompt,
    mode: 'together',
    priority: 'medium',
    evidenceRefs: [receipt],
  }
}

export interface JdkReleaseTransportSignals {
  parentSessionBound: boolean
  capsuleBound: boolean
  sameOriginBound: boolean
  delegatedBridgeConfigured: boolean
}

export type JdkReleaseTransportDecision = {
  state: 'ready' | 'blocked_pending_transport'
  reasons: string[]
}

export function evaluateJdkReleaseTransport(
  signals: JdkReleaseTransportSignals,
): JdkReleaseTransportDecision {
  const reasons: string[] = []
  if (signals.parentSessionBound) reasons.push('PARENT_SESSION_BOUND')
  if (signals.capsuleBound) reasons.push('CAPSULE_BOUND')
  if (signals.sameOriginBound) reasons.push('SAME_ORIGIN_BOUND')
  if (!signals.delegatedBridgeConfigured) reasons.push('DELEGATED_BRIDGE_MISSING')

  return {
    state: reasons.length ? 'blocked_pending_transport' : 'ready',
    reasons,
  }
}
