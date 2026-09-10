import type { ArtifactRegistry, DailyArtifactCapsule } from './artifact-registry.ts'
import { createDailyArtifactCapsule } from './artifact-registry.ts'
import type { CandidateState, CaptureEvent } from './lifecycle.ts'
import type { WorkState } from './contracts.ts'

export interface DailyCapsuleCandidateObservation {
  state: CandidateState
}

export interface DailyCapsuleTaskObservation {
  workState: WorkState
}

export interface FamilyDailyCapsule {
  version: 1
  date: string
  artifacts: DailyArtifactCapsule
  captures: {
    total: number
    byKind: Record<CaptureEvent['kind'], number>
  }
  candidates: {
    total: number
    byState: Record<CandidateState, number>
  }
  tasks: {
    total: number
    byState: Record<WorkState, number>
  }
}

const CAPTURE_KINDS: readonly CaptureEvent['kind'][] = ['want', 'decision', 'fact', 'question', 'final_artifact']
const CANDIDATE_STATES: readonly CandidateState[] = ['proposed', 'accepted', 'declined', 'expired']
const WORK_STATES: readonly WorkState[] = ['hold', 'open', 'in_progress', 'risk', 'done']

function zeroes<T extends string>(values: readonly T[]): Record<T, number> {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>
}

function countKnown<T extends string>(values: readonly T[], key: T, code: string): Record<T, number> {
  if (!values.includes(key)) throw new Error(code)
  const counts = zeroes(values)
  counts[key] = 1
  return counts
}

function mergeCounts<T extends string>(target: Record<T, number>, increment: Record<T, number>): void {
  for (const key of Object.keys(target) as T[]) target[key] += increment[key] ?? 0
}

/**
 * Creates a privacy-safe family day projection from already-authorized read models.
 * It performs no provider reads, persistence, scheduling, or lifecycle transitions.
 */
export function createFamilyDailyCapsule(input: {
  date: string
  artifactRegistry: ArtifactRegistry
  captures: readonly Pick<CaptureEvent, 'kind'>[]
  candidates: readonly DailyCapsuleCandidateObservation[]
  tasks: readonly DailyCapsuleTaskObservation[]
}): FamilyDailyCapsule {
  const captureCounts = zeroes(CAPTURE_KINDS)
  for (const capture of input.captures) {
    mergeCounts(captureCounts, countKnown(CAPTURE_KINDS, capture.kind, 'DAILY_CAPSULE_CAPTURE_KIND_INVALID'))
  }

  const candidateCounts = zeroes(CANDIDATE_STATES)
  for (const candidate of input.candidates) {
    mergeCounts(candidateCounts, countKnown(CANDIDATE_STATES, candidate.state, 'DAILY_CAPSULE_CANDIDATE_STATE_INVALID'))
  }

  const taskCounts = zeroes(WORK_STATES)
  for (const task of input.tasks) {
    mergeCounts(taskCounts, countKnown(WORK_STATES, task.workState, 'DAILY_CAPSULE_TASK_STATE_INVALID'))
  }

  return {
    version: 1,
    date: input.date,
    artifacts: createDailyArtifactCapsule({ date: input.date, registry: input.artifactRegistry }),
    captures: { total: input.captures.length, byKind: captureCounts },
    candidates: { total: input.candidates.length, byState: candidateCounts },
    tasks: { total: input.tasks.length, byState: taskCounts },
  }
}
