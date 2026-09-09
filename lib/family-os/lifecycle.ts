import type { AuthorityDecision } from './authority.ts'
import { requiresExplicitHumanGate } from './authority.ts'
import type {
  ConsentGrant,
  EvidenceRef,
  EvidenceState,
  FamilyBlock,
  JobMode,
  Opportunity,
  PrivacyScope,
  WorkState,
} from './contracts.ts'
import type { PlannerWish } from './family-planner.ts'

/** A raw record of something a person said or decided — original text, source, and what is still unknown. */
export interface CaptureEvent {
  id: string
  personId: string
  privacyScope: PrivacyScope
  kind: 'want' | 'decision' | 'fact' | 'question' | 'final_artifact'
  statedText: string
  source: EvidenceRef['sourceType']
  occurredAt: string
  capturedAt: string
  capturedBy: string
  evidenceRefs: string[]
  unknowns: string[]
}

export type CandidateState = 'proposed' | 'accepted' | 'declined' | 'expired'

const DEFAULT_CANDIDATE_TTL_DAYS = 14
const ACTIONABLE_CAPTURE_KINDS = new Set<CaptureEvent['kind']>(['want', 'decision', 'final_artifact'])

const ALLOWED_TASK_TRANSITIONS: Record<WorkState, WorkState[]> = {
  open: ['in_progress', 'hold', 'risk'],
  hold: ['open'],
  in_progress: ['done', 'risk', 'hold'],
  risk: ['in_progress', 'hold', 'done'],
  done: [],
}

/** Display-only mapping. `together` never becomes a new stored value — it only reads as "Hybrid". */
export function jobModeLabel(mode: JobMode): 'Digital' | 'Physical' | 'Hybrid' {
  switch (mode) {
    case 'digital':
      return 'Digital'
    case 'physical':
      return 'Physical'
    case 'together':
      return 'Hybrid'
    default: {
      const exhaustive: never = mode
      throw new Error(`UNKNOWN_JOB_MODE:${String(exhaustive)}`)
    }
  }
}

/** CandidateState is never stored — it is derived from `decision` and the capture-to-now age. */
export function deriveCandidateState(
  candidate: Opportunity,
  input: { nowIso: string; createdAtIso: string; ttlDays?: number },
): CandidateState {
  const nowMs = Date.parse(input.nowIso)
  const createdAtMs = Date.parse(input.createdAtIso)
  if (Number.isNaN(nowMs) || Number.isNaN(createdAtMs)) throw new Error('ISO_DATE_INVALID')
  if (candidate.decision?.kind === 'accept') return 'accepted'
  if (candidate.decision?.kind === 'decline') return 'declined'
  const ttlDays = input.ttlDays ?? DEFAULT_CANDIDATE_TTL_DAYS
  const expiresAtMs = createdAtMs + ttlDays * 24 * 60 * 60 * 1000
  if (nowMs >= expiresAtMs) return 'expired'
  return 'proposed'
}

/** A capture becomes a Candidate only when it states a want, a decision, or a final artifact. */
export function proposeCandidate(input: {
  capture: CaptureEvent
  proposedBy: string
  id: string
  title?: string
  mode: JobMode
  estimatedMinutes?: number
  priority?: Opportunity['priority']
  kind?: Opportunity['kind']
}): Opportunity {
  if (!ACTIONABLE_CAPTURE_KINDS.has(input.capture.kind)) {
    throw new Error('CAPTURE_KIND_NOT_ACTIONABLE')
  }
  return {
    id: input.id,
    ownerId: input.capture.personId,
    title: input.title ?? input.capture.statedText,
    mode: input.mode,
    kind: input.kind,
    estimatedMinutes: input.estimatedMinutes,
    priority: input.priority,
    evidenceRefs: input.capture.evidenceRefs,
    sourceCaptureId: input.capture.id,
    proposedBy: input.proposedBy,
    privacyScope: input.capture.privacyScope,
  }
}

/** Human Decision is the only transition into Task. `chad` can never author it. */
export function decideCandidate(
  candidate: Opportunity,
  decision: { by: string; at: string; kind: 'accept' | 'decline'; evidenceRef: string },
): Opportunity {
  if (!decision.by || decision.by === 'chad') throw new Error('HUMAN_DECISION_REQUIRED')
  if (candidate.decision) throw new Error('CANDIDATE_ALREADY_DECIDED')
  if (!decision.evidenceRef) throw new Error('DECISION_EVIDENCE_REQUIRED')
  return { ...candidate, decision: { ...decision } }
}

/** Only an accepted candidate can become a Task. The acceptance record stays on the candidate. */
export function taskFromAcceptedCandidate(
  candidate: Opportunity,
  input: {
    id: string
    now: string
    physicalOwnerIds?: string[]
    executor?: 'chad'
    authorityRef?: string
    evidenceState?: EvidenceState
  },
): FamilyBlock {
  if (candidate.decision?.kind !== 'accept') throw new Error('CANDIDATE_NOT_ACCEPTED')
  const evidenceRefs = [...candidate.evidenceRefs, candidate.decision.evidenceRef]
  return {
    id: input.id,
    type: 'action',
    workMode: candidate.mode,
    reality: {
      title: candidate.title,
      durationMinutes: candidate.estimatedMinutes,
    },
    evidenceRefs,
    evidenceState: evidenceRefs.length === 0 ? 'unknown' : (input.evidenceState ?? 'unknown'),
    people: {
      subjectIds: [candidate.ownerId],
      physicalOwnerIds: input.physicalOwnerIds ?? [],
      approverIds: [candidate.decision.by],
      recipientIds: [],
    },
    digital: { executor: input.executor, jobs: [] },
    authorityRef: input.authorityRef,
    timeEngine: { protected: false, priority: candidate.priority },
    dependencyIds: [],
    childBlockIds: [],
    workState: 'open',
    candidateId: candidate.id,
    privacyScope: candidate.privacyScope,
  }
}

/** human_only = nobody digital is executing it, and it needs a physical owner in the world. */
export function isHumanOnlyTask(task: FamilyBlock): boolean {
  return task.digital.executor === undefined && task.people.physicalOwnerIds.length > 0
}

export function transitionTask(
  task: FamilyBlock,
  next: WorkState,
  input: {
    nowIso: string
    authority?: AuthorityDecision
    // Required (not merely optional) whenever a chad-executed task starts work — see below.
    // `null` is the caller's explicit declaration of "no external action here"; `undefined` is
    // treated as a missing declaration, never as an implicit null.
    consequential?: { domain: ConsentGrant['domain']; action: ConsentGrant['actions'][number] } | null
    readbackEvidenceRefs?: string[]
  },
): FamilyBlock {
  const allowed = ALLOWED_TASK_TRANSITIONS[task.workState] ?? []
  if (!allowed.includes(next)) throw new Error('TASK_TRANSITION_INVALID')

  if (task.digital.executor === 'chad' && next === 'in_progress') {
    // A3's API layer must derive { domain, action } from the job spec (ChadJobRef) and pass it
    // here — it must never pass `null` for a gmail/files/payments/publishing job. `null` is only
    // valid when the job genuinely performs no external consequential action.
    if (input.consequential === undefined) {
      throw new Error('CONSEQUENTIAL_DECLARATION_REQUIRED')
    }
    if (input.consequential && requiresExplicitHumanGate(input.consequential.domain, input.consequential.action)) {
      // Defense in depth: even a mis-resolved 'auto' authority can never start a consequential action.
      throw new Error('AUTHORITY_GATE_REQUIRED')
    }
    if (!input.authority || input.authority.state !== 'auto') {
      throw new Error('AUTHORITY_GATE_REQUIRED')
    }
  }

  if (next === 'done') {
    if (!input.readbackEvidenceRefs || input.readbackEvidenceRefs.length === 0) {
      throw new Error('READBACK_EVIDENCE_REQUIRED')
    }
    return {
      ...task,
      workState: next,
      closure: { executedAt: input.nowIso, readbackEvidenceRefs: input.readbackEvidenceRefs },
    }
  }

  return { ...task, workState: next }
}

/** null when there is nothing to place on a calendar, the task is already done, or it has no owner. */
export function taskToPlannerWish(task: FamilyBlock): PlannerWish | null {
  if (task.reality.durationMinutes == null || task.workState === 'done') return null
  const owner = task.people.subjectIds[0]
  if (owner == null) return null
  return {
    id: task.id,
    title: task.reality.title,
    minutes: task.reality.durationMinutes,
    estimated: true,
    required: task.timeEngine.priority === 'high',
    owner,
  }
}

/**
 * Read-authorization boundary (②). Own lane: everything. Other lane, viewed by a child: nothing,
 * ever. Other lane, viewed by an adult: `family` always, plus `personal` when the lane itself
 * belongs to a child — this mirrors `validateCaptureWrite`'s adult-proxy-write rule (an adult may
 * write a child's `personal` capture, so they may also read it back). `professional` is never
 * visible outside its own lane, regardless of anyone's access.
 *
 * `item.access` is the *lane owner's* household access, not the viewer's — it is optional and
 * fails closed: omitting it (an unknown personId, or a caller that hasn't looked it up) is treated
 * as "not a child's lane", i.e. the conservative family-only behavior.
 */
export function canReadLifecycleItem(input: {
  item: { personId: string; privacyScope: PrivacyScope; access?: 'adult' | 'child' }
  viewer: { personId: string; access: 'adult' | 'child' }
}): boolean {
  if (input.item.personId === input.viewer.personId) return true
  if (input.item.privacyScope === 'professional') return false
  if (input.viewer.access === 'child') return false
  if (input.item.privacyScope === 'family') return true
  return input.item.privacyScope === 'personal' && input.item.access === 'child'
}

/** Projection boundary (③). Fail closed: an item without a scope is not family, ever. */
export function projectFamilyLifecycle<T extends { privacyScope?: PrivacyScope }>(items: T[]): T[] {
  return items.filter((item) => item.privacyScope === 'family')
}

/**
 * Write-time boundary (①). The `chad` path is not accepted here — it has its own contract later.
 * `target` describes the lane the capture is being filed into (its owner's personId and access
 * level) — the session alone cannot tell whether another lane belongs to a child, which is what
 * decides whether an adult proxy-write is even possible. Check order is deliberate: lane mismatch
 * is checked before privacy scope, so a child targeting another lane always fails LANE_MISMATCH
 * even when the scope would independently have been denied too.
 */
export function validateCaptureWrite(input: {
  capture: CaptureEvent
  session: { personId: string; access: 'adult' | 'child' }
  target: { personId: string; access: 'adult' | 'child' }
}): { ok: true } | { ok: false; code: 'PRIVACY_SCOPE_DENIED' | 'LANE_MISMATCH' | 'CAPTURED_BY_MISMATCH' } {
  const { capture, session, target } = input
  const ownLane = session.personId === target.personId

  if (!ownLane) {
    // Adult proxy-writes are allowed only into a child's lane. Adult-into-adult and any child
    // writing into someone else's lane are both LANE_MISMATCH.
    if (session.access !== 'adult' || target.access !== 'child') {
      return { ok: false, code: 'LANE_MISMATCH' }
    }
  }

  if (capture.privacyScope === 'professional') {
    // Professional is writable only by an adult into their own lane — never by a child (even their
    // own lane) and never proxied into anyone else's lane.
    if (!ownLane || session.access === 'child') {
      return { ok: false, code: 'PRIVACY_SCOPE_DENIED' }
    }
  }

  if (capture.capturedBy !== session.personId) return { ok: false, code: 'CAPTURED_BY_MISMATCH' }

  return { ok: true }
}
