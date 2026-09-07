import type { JobMode } from './contracts.ts'

export interface WorkModeSignals {
  chadCanExecuteDigital: boolean
  requiresPhysicalAction: boolean
  requiresHumanDecision: boolean
  requiresHumanApproval: boolean
}

export function classifyWorkMode(signals: WorkModeSignals): JobMode {
  const humanJudgment = signals.requiresHumanDecision || signals.requiresHumanApproval

  if (signals.requiresPhysicalAction && (signals.chadCanExecuteDigital || humanJudgment)) {
    return 'together'
  }
  if (humanJudgment && signals.chadCanExecuteDigital) return 'together'
  if (signals.requiresPhysicalAction) return 'physical'
  if (signals.chadCanExecuteDigital && !humanJudgment) return 'digital'

  return 'together'
}
