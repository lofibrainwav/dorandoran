export type InterruptionDecision = 'silent_recover' | 'batch' | 'ask_now' | 'no_interrupt'

export interface InterruptionSignals {
  recoverable: boolean
  goalBlocked: boolean
  authorityRequired: boolean
  humanJudgmentRequired: boolean
  lowPriority: boolean
}

export function shouldInterruptHuman(signals: InterruptionSignals): InterruptionDecision {
  if (signals.recoverable) return 'silent_recover'
  const humanRequired = signals.authorityRequired || signals.humanJudgmentRequired
  if (!humanRequired) return 'no_interrupt'
  if (signals.lowPriority && !signals.goalBlocked) return 'batch'
  if (signals.goalBlocked) return 'ask_now'
  return 'batch'
}
