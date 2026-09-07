import type { HandoffContract, JobMode } from './contracts.ts'

export function createHandoff(input: {
  id: string
  goalId: string
  fromMode: JobMode
  toMode: JobMode
  description: string
}): HandoffContract {
  return { ...input, state: 'pending', evidenceRefs: [] }
}

export function completeHandoff(handoff: HandoffContract): HandoffContract {
  return { ...structuredClone(handoff), state: 'completed' }
}

export function verifyHandoff(handoff: HandoffContract, evidenceRefs: string[]): HandoffContract {
  if (handoff.state !== 'completed') throw new Error('HANDOFF_NOT_COMPLETED')
  const evidence = [...new Set(evidenceRefs.filter(Boolean))]
  if (evidence.length === 0) throw new Error('HANDOFF_EVIDENCE_REQUIRED')
  return { ...structuredClone(handoff), state: 'verified', evidenceRefs: evidence }
}
