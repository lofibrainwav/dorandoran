import type { EvidenceRef, EvidenceState } from './contracts.ts'

export function reconcileEvidence(refs: EvidenceRef[]): EvidenceState {
  if (refs.length === 0) return 'unknown'
  if (refs.some((ref) => ref.state === 'contradicted')) return 'contradicted'
  if (refs.some((ref) => ref.state === 'confirmed')) return 'confirmed'
  if (refs.every((ref) => ref.state === 'stale')) return 'stale'
  if (refs.some((ref) => ref.state === 'inferred')) return 'inferred'
  return 'unknown'
}
