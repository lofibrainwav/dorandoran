import type { ConsentGrant, JobMode, RouteProfile, TransitionAssessment } from './contracts.ts'
import { resolveAuthority, type AuthorityDecision } from './authority.ts'
import { assessTransition } from './transition.ts'
import { classifyWorkMode, type WorkModeSignals } from './work-mode.ts'
import { shouldInterruptHuman, type InterruptionDecision } from './interruption.ts'

export interface ChadDecisionInput {
  work: WorkModeSignals
  digitalAction?: {
    capable: boolean
    subjectId: string
    domain: ConsentGrant['domain']
    action: ConsentGrant['actions'][number]
    nowIso: string
    grant?: ConsentGrant
  }
  recoveryNeeded: boolean
  recoveryAvailable: boolean
  goalBlocked: boolean
  lowPriority: boolean
  routeProfile?: RouteProfile
}

export interface ChadDecision {
  workMode: JobMode
  nextStep: 'recover' | 'execute' | 'ask' | 'handoff' | 'wait' | 'blocked'
  interruption: InterruptionDecision
  authority?: AuthorityDecision
  transition?: TransitionAssessment
  reasons: string[]
}

export function decideChadNextStep(input: ChadDecisionInput): ChadDecision {
  const workMode = classifyWorkMode(input.work)
  const transition = input.routeProfile ? assessTransition(input.routeProfile) : undefined
  const reasons: string[] = []

  if (input.recoveryNeeded && input.recoveryAvailable) {
    reasons.push('RECOVER_FIRST')
    return {
      workMode,
      nextStep: 'recover',
      interruption: shouldInterruptHuman({
        recoverable: true,
        goalBlocked: input.goalBlocked,
        authorityRequired: false,
        humanJudgmentRequired: false,
        lowPriority: input.lowPriority,
      }),
      transition,
      reasons,
    }
  }

  const authority = input.digitalAction ? resolveAuthority(input.digitalAction) : undefined
  if (authority?.state === 'blocked') {
    reasons.push(authority.reason)
    return { workMode, nextStep: 'blocked', interruption: 'no_interrupt', authority, transition, reasons }
  }

  const authorityRequired = authority?.state === 'gate_required'
  const judgmentRequired = input.work.requiresHumanDecision || input.work.requiresHumanApproval

  if (authorityRequired || judgmentRequired) {
    const interruption = shouldInterruptHuman({
      recoverable: false,
      goalBlocked: input.goalBlocked,
      authorityRequired,
      humanJudgmentRequired: judgmentRequired,
      lowPriority: input.lowPriority,
    })
    reasons.push(authority?.reason ?? (judgmentRequired ? 'HUMAN_JUDGMENT_REQUIRED' : 'HUMAN_GATE_REQUIRED'))
    return {
      workMode,
      nextStep: interruption === 'ask_now' ? 'ask' : 'wait',
      interruption,
      authority,
      transition,
      reasons,
    }
  }

  if (workMode === 'digital') {
    if (!input.digitalAction || authority?.state !== 'auto') {
      reasons.push('DIGITAL_AUTHORITY_NOT_READY')
      return { workMode, nextStep: 'blocked', interruption: 'no_interrupt', authority, transition, reasons }
    }
    reasons.push('AUTHORIZED_DIGITAL_EXECUTION')
    return { workMode, nextStep: 'execute', interruption: 'no_interrupt', authority, transition, reasons }
  }

  reasons.push(workMode === 'physical' ? 'PHYSICAL_HANDOFF_REQUIRED' : 'TOGETHER_HANDOFF_REQUIRED')
  return { workMode, nextStep: 'handoff', interruption: 'no_interrupt', authority, transition, reasons }
}
