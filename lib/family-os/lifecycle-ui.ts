// Pure, DOM-free presentation logic for the A4 lifecycle lane UI. Kept separate from the client
// component so lane visibility, scope-option gating, and the decide/transition rules mirrored
// client-side (server remains the source of truth) are unit-testable without rendering anything.

import type { PrivacyScope, WorkState } from './contracts.ts'
import type { CandidateState } from './lifecycle.ts'

export type HouseholdAccess = 'adult' | 'child'

export interface LaneMember {
  personId: string
  access: HouseholdAccess
  label: string
}

/** Own lane first, then — adult viewers only — every other lane. A child viewer sees only their
 * own tab, mirroring the server's read-authorization boundary (a child can never read another
 * lane at all, so there is nothing useful to show a tab for). */
export function visibleLaneMembers(
  viewer: { personId: string; access: HouseholdAccess },
  members: LaneMember[],
): LaneMember[] {
  const own = members.find((member) => member.personId === viewer.personId) ?? {
    personId: viewer.personId,
    access: viewer.access,
    label: viewer.personId.charAt(0).toUpperCase() + viewer.personId.slice(1),
  }
  if (viewer.access === 'child') return [own]
  const others = members.filter((member) => member.personId !== viewer.personId)
  return [own, ...others]
}

export interface PrivacyScopeOption {
  value: PrivacyScope
  label: string
}

/** `professional` is only ever offered when an adult captures into their own lane — mirrors the
 * server's write-time boundary (①): `validateCaptureWrite` refuses `professional` proxied into
 * anyone else's lane, and refuses it outright for a child session even in the child's own lane. */
export function capturePrivacyScopeOptions(
  isOwnLane: boolean,
  viewerAccess: 'adult' | 'child' = 'adult',
): PrivacyScopeOption[] {
  const options: PrivacyScopeOption[] = [
    { value: 'personal', label: '개인' },
    { value: 'family', label: '가족' },
  ]
  if (isOwnLane && viewerAccess === 'adult') options.push({ value: 'professional', label: '업무' })
  return options
}

/** Server-side bound on each `readbackEvidenceRefs` item (`lifecycle-request.ts` EVIDENCE_ITEM_MAX_LENGTH). */
export const READBACK_EVIDENCE_MAX_LENGTH = 200
const READBACK_EVIDENCE_PREFIX = 'human:readback:'

/** How many note characters fit once the `human:readback:{taskId}:` envelope is accounted for. */
export function readbackNoteMaxLength(taskId: string): number {
  return Math.max(0, READBACK_EVIDENCE_MAX_LENGTH - READBACK_EVIDENCE_PREFIX.length - taskId.length - 1)
}

/** Builds the readback evidence string the server expects for a `done` transition. The note is
 * trimmed and clipped so the whole ref never exceeds the server's per-item bound. */
export function readbackEvidenceRef(taskId: string, note: string): string {
  const clipped = note.trim().slice(0, readbackNoteMaxLength(taskId))
  return `${READBACK_EVIDENCE_PREFIX}${taskId}:${clipped}`
}

export function scopeLabel(scope: PrivacyScope): string {
  switch (scope) {
    case 'personal':
      return '개인'
    case 'family':
      return '가족'
    case 'professional':
      return '업무'
    default: {
      const exhaustive: never = scope
      return String(exhaustive)
    }
  }
}

export function candidateStateLabel(state: CandidateState): string {
  switch (state) {
    case 'proposed':
      return '제안됨'
    case 'accepted':
      return '수락됨'
    case 'declined':
      return '거절됨'
    case 'expired':
      return '만료됨'
    default: {
      const exhaustive: never = state
      return String(exhaustive)
    }
  }
}

export function workStateLabel(state: WorkState): string {
  switch (state) {
    case 'open':
      return '열림'
    case 'hold':
      return '보류'
    case 'in_progress':
      return '진행 중'
    case 'risk':
      return '주의'
    case 'done':
      return '완료'
    default: {
      const exhaustive: never = state
      return String(exhaustive)
    }
  }
}

/** Client-side mirror of the server's decide-actor rule (never authoritative — the server always
 * re-checks). A viewer may decide a Candidate in their own lane, or — if an adult — in a child's
 * lane. Never the reverse, and never adult-over-adult. */
export function canDecideCandidate(input: {
  viewerPersonId: string
  viewerAccess: HouseholdAccess
  targetPersonId: string
  targetAccess?: HouseholdAccess
}): boolean {
  if (input.viewerPersonId === input.targetPersonId) return true
  return input.viewerAccess === 'adult' && input.targetAccess === 'child'
}

export interface TaskTransitionAction {
  next: WorkState
  label: string
}

const TASK_TRANSITION_LABELS: Record<WorkState, TaskTransitionAction[]> = {
  open: [
    { next: 'in_progress', label: '시작' },
    { next: 'hold', label: '보류' },
    { next: 'risk', label: '주의' },
  ],
  hold: [{ next: 'open', label: '다시 열기' }],
  in_progress: [
    { next: 'done', label: '완료' },
    { next: 'risk', label: '주의' },
    { next: 'hold', label: '보류' },
  ],
  risk: [
    { next: 'in_progress', label: '진행' },
    { next: 'hold', label: '보류' },
    { next: 'done', label: '완료' },
  ],
  done: [],
}

/** The A1 transition graph, labeled in Korean for buttons. Purely presentational — the server is
 * the sole authority on whether a transition is actually allowed. */
export function taskTransitionActions(workState: WorkState): TaskTransitionAction[] {
  return TASK_TRANSITION_LABELS[workState] ?? []
}

const CAPTURE_KIND_OPTIONS: Array<{ value: 'want' | 'decision' | 'fact' | 'question'; label: string }> = [
  { value: 'want', label: '하고 싶은 것' },
  { value: 'decision', label: '결정' },
  { value: 'fact', label: '사실' },
  { value: 'question', label: '질문' },
]

export function captureKindOptions() {
  return CAPTURE_KIND_OPTIONS
}

const JOB_MODE_OPTIONS: Array<{ value: 'digital' | 'physical' | 'together'; label: string }> = [
  { value: 'digital', label: '디지털' },
  { value: 'physical', label: '현장' },
  { value: 'together', label: 'Hybrid' },
]

export function jobModeOptions() {
  return JOB_MODE_OPTIONS
}
