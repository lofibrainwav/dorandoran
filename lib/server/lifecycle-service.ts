import type { JobMode, Opportunity, PrivacyScope, WorkState } from '../family-os/contracts.ts'
import type { HouseholdAccess, HouseholdMember } from '../family-os/google-household-identity.ts'
import type { CandidateState, CaptureEvent } from '../family-os/lifecycle.ts'
import {
  canReadLifecycleItem,
  decideCandidate as applyCandidateDecision,
  deriveCandidateState,
  projectFamilyLifecycle,
  proposeCandidate,
  taskFromAcceptedCandidate,
  transitionTask as applyTaskTransition,
  validateCaptureWrite,
} from '../family-os/lifecycle.ts'
import { clampLimit, type CandidateRecord, type LifecycleStore, type TaskRecord } from './lifecycle-store.ts'

export interface LifecycleServiceDeps {
  store: LifecycleStore
  membership: HouseholdMember[]
  now: () => string
  newId: () => string
}

export interface CaptureInput {
  personId?: string
  privacyScope: PrivacyScope
  kind: CaptureEvent['kind']
  statedText: string
  source: CaptureEvent['source']
  occurredAt?: string
  evidenceRefs?: string[]
  unknowns?: string[]
  propose?: { mode: JobMode; estimatedMinutes?: number; priority?: Opportunity['priority'] }
}

export interface CaptureResult {
  capture: CaptureEvent
  candidate?: CandidateRecord
}

export interface ListCandidatesInput {
  personId?: string
  limit?: number
}

export type CandidateWithState = CandidateRecord & { state: CandidateState }

export interface DecideCandidateInput {
  candidateId: string
  personId: string
  kind: 'accept' | 'decline'
  // Accepted for future use — A1/A2 carry no field to persist a decision note into yet, and A3
  // adds no new columns (constitution: no new field unless an existing one cannot express it).
  note?: string
  expectedVersion: number
}

export interface DecideCandidateResult {
  candidate: CandidateRecord
  task?: TaskRecord
  // Set only when this call self-healed an already-accepted Candidate that had no Task on record
  // (e.g. a crash between the old, non-atomic UPDATE and INSERT, before acceptCandidate existed).
  // The candidate's own decision is untouched — only the missing Task was re-derived and stored.
  repaired?: true
}

export interface ListTasksInput {
  personId?: string
  workStates?: WorkState[]
  limit?: number
}

export interface ListFamilyTasksInput {
  limit?: number
}

export interface TransitionTaskInput {
  taskId: string
  personId: string
  next: WorkState
  readbackEvidenceRefs?: string[]
  expectedVersion: number
}

export interface TransitionTaskResult {
  task: TaskRecord
}

export interface LifecycleService {
  readableScopes(viewer: HouseholdMember, targetPersonId: string): PrivacyScope[]
  capture(viewer: HouseholdMember, input: CaptureInput): Promise<CaptureResult>
  listCandidates(viewer: HouseholdMember, input: ListCandidatesInput): Promise<CandidateWithState[]>
  decideCandidate(viewer: HouseholdMember, input: DecideCandidateInput): Promise<DecideCandidateResult>
  listTasks(viewer: HouseholdMember, input: ListTasksInput): Promise<TaskRecord[]>
  listFamilyTasks(viewer: HouseholdMember, input: ListFamilyTasksInput): Promise<TaskRecord[]>
  transitionTask(viewer: HouseholdMember, input: TransitionTaskInput): Promise<TransitionTaskResult>
}

/**
 * Read-authorization boundary (②), scope-list form. Must stay consistent with A1's
 * `canReadLifecycleItem` for every (viewer.access, own/other lane, item.privacyScope,
 * item's-owner-access) combination — a dedicated test cross-checks both.
 *
 * `targetAccess` is the household access of the lane being read (not the viewer's own access) —
 * an adult may read a child's lane's `personal` scope too, mirroring the adult proxy-write rule in
 * `validateCaptureWrite`. Omitting it (unknown personId, or a caller that hasn't looked it up)
 * fails closed to the conservative family-only behavior — [product decision, flagged for review:
 * an adult reading another *adult's* lane still gets family-only; only a child-owned lane grants
 * the extra `personal` scope].
 */
export function readableScopes(
  viewer: HouseholdMember,
  targetPersonId: string,
  targetAccess?: HouseholdAccess,
): PrivacyScope[] {
  if (viewer.personId === targetPersonId) return ['personal', 'family', 'professional']
  if (viewer.access !== 'adult') return []
  return targetAccess === 'child' ? ['personal', 'family'] : ['family']
}

/** The only actors who may record a human decision for a lane: the lane's own owner, or an adult
 * acting for a child's lane. Never the reverse, and never adult-over-adult. */
function assertActorAllowed(viewer: HouseholdMember, targetPersonId: string, membership: HouseholdMember[]): void {
  if (viewer.personId === targetPersonId) return
  const target = membership.find((member) => member.personId === targetPersonId)
  if (viewer.access === 'adult' && target?.access === 'child') return
  throw new Error('DECISION_NOT_ALLOWED')
}

/** Renames the store's optimistic-concurrency error onto the service's own vocabulary so
 * `lifecycleErrorToHttp` has one 409 code to map, regardless of which record type conflicted. */
async function withVersionConflictRenamed<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof Error && error.message === 'LIFECYCLE_VERSION_CONFLICT') {
      throw new Error('VERSION_CONFLICT')
    }
    throw error
  }
}

function sortByUpdatedAtDescThenIdAsc<T extends { id: string; updatedAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
}

export function createLifecycleService(deps: LifecycleServiceDeps): LifecycleService {
  const { store, membership, now, newId } = deps

  function accessOf(personId: string): HouseholdAccess | undefined {
    return membership.find((member) => member.personId === personId)?.access
  }

  /** Membership-aware wrapper around the pure `readableScopes` — every call site inside the
   * service goes through here so the target's household access is always looked up consistently. */
  function scopesFor(viewer: HouseholdMember, targetPersonId: string): PrivacyScope[] {
    return readableScopes(viewer, targetPersonId, accessOf(targetPersonId))
  }

  function canRead(viewer: HouseholdMember, item: { personId: string; privacyScope: PrivacyScope }): boolean {
    return canReadLifecycleItem({ item: { ...item, access: accessOf(item.personId) }, viewer })
  }

  function buildTaskRecord(input: { candidate: CandidateRecord; decidedOpportunity: Opportunity; personId: string; nowIso: string }): TaskRecord {
    const block = taskFromAcceptedCandidate(input.decidedOpportunity, {
      id: newId(),
      now: input.nowIso,
      physicalOwnerIds: [input.personId],
    })
    return {
      id: block.id,
      personId: input.personId,
      privacyScope: block.privacyScope ?? input.candidate.privacyScope,
      candidateId: input.candidate.id,
      block,
      workState: block.workState,
      authorityRef: block.authorityRef,
      version: 1,
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    }
  }

  async function capture(viewer: HouseholdMember, input: CaptureInput): Promise<CaptureResult> {
    const targetPersonId = input.personId ?? viewer.personId
    const target = membership.find((member) => member.personId === targetPersonId)
    if (!target) throw new Error('LANE_MISMATCH')

    const statedText = input.statedText.trim()
    if (statedText.length < 1 || statedText.length > 2000) throw new Error('CAPTURE_TEXT_INVALID')

    const nowIso = now()
    const captureEvent: CaptureEvent = {
      id: newId(),
      personId: targetPersonId,
      privacyScope: input.privacyScope,
      kind: input.kind,
      statedText,
      source: input.source,
      occurredAt: input.occurredAt ?? nowIso,
      capturedAt: nowIso,
      capturedBy: viewer.personId,
      evidenceRefs: input.evidenceRefs ?? [],
      unknowns: input.unknowns ?? [],
    }

    const validation = validateCaptureWrite({
      capture: captureEvent,
      session: { personId: viewer.personId, access: viewer.access },
      target: { personId: target.personId, access: target.access },
    })
    if (!validation.ok) throw new Error(validation.code)

    await store.putCapture(captureEvent)

    let candidate: CandidateRecord | undefined
    if (input.propose) {
      const opportunity = proposeCandidate({
        capture: captureEvent,
        proposedBy: viewer.personId,
        id: newId(),
        mode: input.propose.mode,
        estimatedMinutes: input.propose.estimatedMinutes,
        priority: input.propose.priority,
      })
      const record: CandidateRecord = {
        id: opportunity.id,
        personId: targetPersonId,
        privacyScope: captureEvent.privacyScope,
        sourceCaptureId: captureEvent.id,
        proposedBy: viewer.personId,
        opportunity,
        version: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      }
      await store.insertCandidate(record)
      candidate = record
    }

    return { capture: captureEvent, candidate }
  }

  async function listCandidates(viewer: HouseholdMember, input: ListCandidatesInput): Promise<CandidateWithState[]> {
    const targetPersonId = input.personId ?? viewer.personId
    const scopes = scopesFor(viewer, targetPersonId)
    const records = await store.listCandidates({ personId: targetPersonId, scopes, limit: input.limit })
    const nowIso = now()
    return records
      .filter((record) => canRead(viewer, { personId: record.personId, privacyScope: record.privacyScope }))
      .map((record) => ({
        ...record,
        state: deriveCandidateState(record.opportunity, { nowIso, createdAtIso: record.createdAt }),
      }))
  }

  async function decideCandidate(viewer: HouseholdMember, input: DecideCandidateInput): Promise<DecideCandidateResult> {
    const scopes = scopesFor(viewer, input.personId)
    const record = await store.getCandidate({ id: input.candidateId, personId: input.personId, scopes })
    if (!record) throw new Error('CANDIDATE_NOT_FOUND')

    assertActorAllowed(viewer, input.personId, membership)

    // Self-healing: an already-accepted Candidate that somehow has no Task on record (only
    // reachable from data that predates atomic `acceptCandidate`, e.g. a crash between the old
    // separate UPDATE and INSERT) is repaired here instead of surfaced as a 409. The candidate's
    // existing decision is left untouched — only the missing Task is re-derived and stored.
    if (record.decision?.kind === 'accept') {
      const existingTask = await store.getTaskByCandidateId({ candidateId: record.id, personId: input.personId, scopes })
      if (!existingTask) {
        const nowIso = now()
        const taskRecord = buildTaskRecord({
          candidate: record,
          decidedOpportunity: record.opportunity,
          personId: input.personId,
          nowIso,
        })
        await store.insertTask(taskRecord)
        return { candidate: record, task: taskRecord, repaired: true }
      }
      // A Task already exists — this is a genuine repeat decide attempt, not a repair. Fall
      // through so the normal already-decided error below is what the caller sees.
    }

    const nowIso = now()
    const evidenceRef = `human:decision:${input.candidateId}:${nowIso}`
    const decidedOpportunity = applyCandidateDecision(record.opportunity, {
      by: viewer.personId,
      at: nowIso,
      kind: input.kind,
      evidenceRef,
    })

    const updatedRecord: CandidateRecord = {
      ...record,
      opportunity: decidedOpportunity,
      decision: decidedOpportunity.decision,
      updatedAt: nowIso,
    }

    if (input.kind === 'accept') {
      const taskRecord = buildTaskRecord({ candidate: record, decidedOpportunity, personId: input.personId, nowIso })
      await withVersionConflictRenamed(() =>
        store.acceptCandidate({ candidate: updatedRecord, expectedVersion: input.expectedVersion, task: taskRecord }),
      )
      const persistedCandidate: CandidateRecord = { ...updatedRecord, version: input.expectedVersion + 1 }
      return { candidate: persistedCandidate, task: taskRecord }
    }

    await withVersionConflictRenamed(() => store.updateCandidate(updatedRecord, input.expectedVersion))
    const persistedCandidate: CandidateRecord = { ...updatedRecord, version: input.expectedVersion + 1 }
    return { candidate: persistedCandidate }
  }

  async function listTasks(viewer: HouseholdMember, input: ListTasksInput): Promise<TaskRecord[]> {
    const targetPersonId = input.personId ?? viewer.personId
    const scopes = scopesFor(viewer, targetPersonId)
    const records = await store.listTasks({
      personId: targetPersonId,
      scopes,
      workStates: input.workStates,
      limit: input.limit,
    })
    return records.filter((record) => canRead(viewer, { personId: record.personId, privacyScope: record.privacyScope }))
  }

  async function listFamilyTasks(viewer: HouseholdMember, input: ListFamilyTasksInput): Promise<TaskRecord[]> {
    const limit = clampLimit(input.limit)
    const perMember = await Promise.all(
      membership.map((member) => store.listTasks({ personId: member.personId, scopes: ['family'], limit })),
    )
    const projected = projectFamilyLifecycle(perMember.flat())
    // Defense in depth: every item is still store-scoped to 'family' and projection-filtered
    // above, but boundary ② is applied here too — a child viewer sees only their own lane's
    // family tasks (canReadLifecycleItem denies a child any other lane, even family-scope ones).
    const readable = projected.filter((task) =>
      canRead(viewer, { personId: task.personId, privacyScope: task.privacyScope }),
    )
    return sortByUpdatedAtDescThenIdAsc(readable).slice(0, limit)
  }

  async function transitionTask(viewer: HouseholdMember, input: TransitionTaskInput): Promise<TransitionTaskResult> {
    const scopes = scopesFor(viewer, input.personId)
    const record = await store.getTask({ id: input.taskId, personId: input.personId, scopes })
    if (!record) throw new Error('TASK_NOT_FOUND')

    assertActorAllowed(viewer, input.personId, membership)

    // A3 mints no chad executor — a stored task that somehow carries one is outside this slice's
    // contract entirely, so it is refused rather than silently handled.
    if (record.block.digital.executor === 'chad') throw new Error('EXECUTOR_NOT_SUPPORTED')

    const nowIso = now()
    const nextBlock = applyTaskTransition(record.block, input.next, {
      nowIso,
      readbackEvidenceRefs: input.readbackEvidenceRefs,
    })

    const updatedRecord: TaskRecord = {
      ...record,
      block: nextBlock,
      workState: nextBlock.workState,
      updatedAt: nowIso,
    }
    await withVersionConflictRenamed(() => store.updateTask(updatedRecord, input.expectedVersion))

    return { task: { ...updatedRecord, version: input.expectedVersion + 1 } }
  }

  return {
    readableScopes: scopesFor,
    capture,
    listCandidates,
    decideCandidate,
    listTasks,
    listFamilyTasks,
    transitionTask,
  }
}

const STATUS_400 = new Set([
  'CANDIDATE_NOT_ACCEPTED',
  'TASK_TRANSITION_INVALID',
  'READBACK_EVIDENCE_REQUIRED',
  'HUMAN_DECISION_REQUIRED',
  'LIFECYCLE_LIMIT_INVALID',
  'EXECUTOR_NOT_SUPPORTED',
])
const STATUS_403 = new Set(['PRIVACY_SCOPE_DENIED', 'LANE_MISMATCH', 'CAPTURED_BY_MISMATCH', 'DECISION_NOT_ALLOWED'])
const STATUS_409 = new Set([
  'VERSION_CONFLICT',
  'CANDIDATE_ALREADY_DECIDED',
  'LIFECYCLE_CANDIDATE_ALREADY_TASKED',
  'LIFECYCLE_DUPLICATE_ID',
])
const STATUS_500 = new Set(['LIFECYCLE_ROW_INVALID', 'LIFECYCLE_TRANSACTION_UNAVAILABLE'])

/** Maps every A1/A2/A3 domain error to an HTTP status + a stable machine-readable code. Anything
 * not on this list — including a non-Error throw — fails closed to 500 `LIFECYCLE_FAILED` rather
 * than leaking an arbitrary message to the client. */
export function lifecycleErrorToHttp(error: unknown): { status: number; code: string } {
  const code = error instanceof Error ? error.message : ''

  if (code.startsWith('CAPTURE_') || STATUS_400.has(code)) return { status: 400, code }
  if (STATUS_403.has(code)) return { status: 403, code }
  if (code.endsWith('_NOT_FOUND')) return { status: 404, code }
  if (STATUS_409.has(code)) return { status: 409, code }
  if (STATUS_500.has(code)) return { status: 500, code }
  return { status: 500, code: 'LIFECYCLE_FAILED' }
}
