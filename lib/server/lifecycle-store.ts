import type { Pool as PgPool } from 'pg'
import type { EvidenceRef, FamilyBlock, JobMode, Opportunity, PrivacyScope, WorkState } from '../family-os/contracts.ts'
import type { CaptureEvent } from '../family-os/lifecycle.ts'

export interface CandidateRecord {
  id: string
  personId: string
  privacyScope: PrivacyScope
  sourceCaptureId?: string
  proposedBy: string
  opportunity: Opportunity
  decision?: Opportunity['decision']
  version: number
  createdAt: string
  updatedAt: string
}

export interface TaskRecord {
  id: string
  personId: string
  privacyScope: PrivacyScope
  candidateId: string
  block: FamilyBlock
  workState: WorkState
  authorityRef?: string
  version: number
  createdAt: string
  updatedAt: string
}

/** By-id reads carry the same scope boundary as list reads: the caller's `personId` and the
 * scopes it is allowed to see. An empty `scopes` array (or a lane/scope mismatch) returns `null`
 * — never distinguishing "not found" from "not visible to you" (fail closed). */
export interface LifecycleByIdInput {
  id: string
  personId: string
  scopes: PrivacyScope[]
}

export interface LifecycleStore {
  putCapture(capture: CaptureEvent): Promise<void>
  getCapture(input: LifecycleByIdInput): Promise<CaptureEvent | null>
  listCaptures(input: { personId: string; scopes: PrivacyScope[]; limit?: number }): Promise<CaptureEvent[]>
  insertCandidate(record: CandidateRecord): Promise<void>
  updateCandidate(record: CandidateRecord, expectedVersion: number): Promise<void>
  getCandidate(input: LifecycleByIdInput): Promise<CandidateRecord | null>
  listCandidates(input: { personId: string; scopes: PrivacyScope[]; limit?: number }): Promise<CandidateRecord[]>
  insertTask(record: TaskRecord): Promise<void>
  updateTask(record: TaskRecord, expectedVersion: number): Promise<void>
  getTask(input: LifecycleByIdInput): Promise<TaskRecord | null>
  listTasks(input: {
    personId: string
    scopes: PrivacyScope[]
    workStates?: WorkState[]
    limit?: number
  }): Promise<TaskRecord[]>
}

export type LifecycleQueryResult = { rows: Record<string, unknown>[]; rowCount: number | null }
export type LifecycleQueryFn = (text: string, params?: unknown[]) => Promise<LifecycleQueryResult>

const DEFAULT_LIST_LIMIT = 50
const MAX_LIST_LIMIT = 500

/** Every list method funnels its `limit` through here: an integer in [1, 500], default 50.
 * Non-finite, non-integer, zero, or negative throws — a caller-input error, checked before the
 * scope boundary is even considered. Anything above 500 is silently clamped down to 500. */
export function clampLimit(limit?: number): number {
  if (limit === undefined) return DEFAULT_LIST_LIMIT
  if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit <= 0) {
    throw new Error('LIFECYCLE_LIMIT_INVALID')
  }
  return Math.min(limit, MAX_LIST_LIMIT)
}

const PRIVACY_SCOPES: readonly PrivacyScope[] = ['personal', 'family', 'professional']
const CAPTURE_KINDS: readonly CaptureEvent['kind'][] = ['want', 'decision', 'fact', 'question', 'final_artifact']
const CAPTURE_SOURCES: readonly EvidenceRef['sourceType'][] = [
  'calendar',
  'email',
  'contact',
  'file',
  'map',
  'web',
  'human',
  'photo',
  'system',
]
const JOB_MODES: readonly JobMode[] = ['digital', 'physical', 'together']
const WORK_STATES: readonly WorkState[] = ['hold', 'open', 'in_progress', 'risk', 'done']
const EVIDENCE_STATES = ['confirmed', 'unknown', 'stale', 'contradicted', 'inferred'] as const
const BLOCK_TYPES = ['event', 'action', 'reminder', 'decision', 'auth'] as const
const LOW_MED_HIGH = ['low', 'medium', 'high'] as const

// ---- row-guard primitives — never trust a jsonb blob or DB row shape blindly ----

function invalid(): never {
  throw new Error('LIFECYCLE_ROW_INVALID')
}

function str(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) invalid()
  return value
}

function optionalStr(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  return str(value)
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid()
  return value
}

function timestamp(value: unknown): string {
  const raw = value instanceof Date ? value.toISOString() : value
  const iso = str(raw)
  if (!Number.isFinite(Date.parse(iso))) invalid()
  return iso
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  const candidate = str(value)
  if (!(allowed as readonly string[]).includes(candidate)) invalid()
  return candidate as T
}

function optionalOneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (value === null || value === undefined) return undefined
  return oneOf(value, allowed)
}

function integer(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isInteger(n)) invalid()
  return n
}

function parsedJson(value: unknown): unknown {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      invalid()
    }
  }
  if (typeof value === 'object') return value
  invalid()
}

function record(value: unknown): Record<string, unknown> {
  const parsed = parsedJson(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) invalid()
  return parsed as Record<string, unknown>
}

function stringArray(value: unknown): string[] {
  const parsed = parsedJson(value)
  if (parsed === undefined) return []
  if (!Array.isArray(parsed)) invalid()
  return parsed.map((item) => str(item))
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined
  return stringArray(value)
}

function chadJobRefArray(value: unknown): FamilyBlock['digital']['jobs'] {
  if (!Array.isArray(value)) invalid()
  return value.map((job) => ({ jobId: str(record(job).jobId) }))
}

// ---- jsonb shape sanitizers ----

function sanitizeDecision(value: unknown): Opportunity['decision'] {
  if (value === null || value === undefined) return undefined
  const r = record(value)
  return {
    by: str(r.by),
    at: timestamp(r.at),
    kind: oneOf(r.kind, ['accept', 'decline'] as const),
    evidenceRef: str(r.evidenceRef),
  }
}

function sanitizeOpportunity(value: unknown): Opportunity {
  const r = record(value)
  const opportunity: Opportunity = {
    id: str(r.id),
    ownerId: str(r.ownerId),
    title: str(r.title),
    mode: oneOf(r.mode, JOB_MODES),
    evidenceRefs: stringArray(r.evidenceRefs),
  }
  const kind = optionalOneOf(r.kind, ['task', 'rest'] as const)
  if (kind !== undefined) opportunity.kind = kind
  const estimatedMinutes = optionalNumber(r.estimatedMinutes)
  if (estimatedMinutes !== undefined) opportunity.estimatedMinutes = estimatedMinutes
  const setupMinutes = optionalNumber(r.setupMinutes)
  if (setupMinutes !== undefined) opportunity.setupMinutes = setupMinutes
  const transitionMinutes = optionalNumber(r.transitionMinutes)
  if (transitionMinutes !== undefined) opportunity.transitionMinutes = transitionMinutes
  const requiredEnergy = optionalOneOf(r.requiredEnergy, LOW_MED_HIGH)
  if (requiredEnergy !== undefined) opportunity.requiredEnergy = requiredEnergy
  const tags = optionalStringArray(r.tags)
  if (tags !== undefined) opportunity.tags = tags
  const priority = optionalOneOf(r.priority, LOW_MED_HIGH)
  if (priority !== undefined) opportunity.priority = priority
  const interest = optionalOneOf(r.interest, LOW_MED_HIGH)
  if (interest !== undefined) opportunity.interest = interest
  const growthValue = optionalOneOf(r.growthValue, LOW_MED_HIGH)
  if (growthValue !== undefined) opportunity.growthValue = growthValue
  const requiredLocation = optionalStr(r.requiredLocation)
  if (requiredLocation !== undefined) opportunity.requiredLocation = requiredLocation
  const requiredTools = optionalStringArray(r.requiredTools)
  if (requiredTools !== undefined) opportunity.requiredTools = requiredTools
  const sourceCaptureId = optionalStr(r.sourceCaptureId)
  if (sourceCaptureId !== undefined) opportunity.sourceCaptureId = sourceCaptureId
  const proposedBy = optionalStr(r.proposedBy)
  if (proposedBy !== undefined) opportunity.proposedBy = proposedBy
  const privacyScope = optionalOneOf(r.privacyScope, PRIVACY_SCOPES)
  if (privacyScope !== undefined) opportunity.privacyScope = privacyScope
  const decision = sanitizeDecision(r.decision)
  if (decision !== undefined) opportunity.decision = decision
  return opportunity
}

function sanitizeFamilyBlock(value: unknown): FamilyBlock {
  const r = record(value)
  const realityRecord = record(r.reality)
  const reality: FamilyBlock['reality'] = { title: str(realityRecord.title) }
  const start = optionalStr(realityRecord.start)
  if (start !== undefined) reality.start = start
  const end = optionalStr(realityRecord.end)
  if (end !== undefined) reality.end = end
  const durationMinutes = optionalNumber(realityRecord.durationMinutes)
  if (durationMinutes !== undefined) reality.durationMinutes = durationMinutes
  const location = optionalStr(realityRecord.location)
  if (location !== undefined) reality.location = location
  const recurrence = optionalStr(realityRecord.recurrence)
  if (recurrence !== undefined) reality.recurrence = recurrence
  if (typeof realityRecord.allDay === 'boolean') reality.allDay = realityRecord.allDay

  const peopleRecord = record(r.people)
  const people: FamilyBlock['people'] = {
    subjectIds: stringArray(peopleRecord.subjectIds),
    physicalOwnerIds: stringArray(peopleRecord.physicalOwnerIds),
    approverIds: stringArray(peopleRecord.approverIds),
    recipientIds: stringArray(peopleRecord.recipientIds),
  }

  const digitalRecord = record(r.digital)
  // Each job must be an object carrying a string jobId — anything else (missing jobId, wrong
  // type, a bare string/number in the array) is rejected rather than passed through untyped.
  const digital: FamilyBlock['digital'] = { jobs: chadJobRefArray(digitalRecord.jobs) }
  const executor = optionalOneOf(digitalRecord.executor, ['chad'] as const)
  if (executor !== undefined) digital.executor = executor

  const timeEngineRecord = record(r.timeEngine)
  if (typeof timeEngineRecord.protected !== 'boolean') invalid()
  const timeEngine: FamilyBlock['timeEngine'] = { protected: timeEngineRecord.protected }
  const priority = optionalOneOf(timeEngineRecord.priority, LOW_MED_HIGH)
  if (priority !== undefined) timeEngine.priority = priority
  const energy = optionalOneOf(timeEngineRecord.energy, LOW_MED_HIGH)
  if (energy !== undefined) timeEngine.energy = energy
  const bufferAfterMinutes = optionalNumber(timeEngineRecord.bufferAfterMinutes)
  if (bufferAfterMinutes !== undefined) timeEngine.bufferAfterMinutes = bufferAfterMinutes
  if (typeof timeEngineRecord.carryover === 'boolean') timeEngine.carryover = timeEngineRecord.carryover
  const rolloverCount = optionalNumber(timeEngineRecord.rolloverCount)
  if (rolloverCount !== undefined) timeEngine.rolloverCount = rolloverCount

  const block: FamilyBlock = {
    id: str(r.id),
    type: oneOf(r.type, BLOCK_TYPES),
    reality,
    evidenceRefs: stringArray(r.evidenceRefs),
    evidenceState: oneOf(r.evidenceState, EVIDENCE_STATES),
    people,
    digital,
    timeEngine,
    dependencyIds: stringArray(r.dependencyIds),
    childBlockIds: stringArray(r.childBlockIds),
    workState: oneOf(r.workState, WORK_STATES),
  }
  const parentBlockId = optionalStr(r.parentBlockId)
  if (parentBlockId !== undefined) block.parentBlockId = parentBlockId
  const candidateId = optionalStr(r.candidateId)
  if (candidateId !== undefined) block.candidateId = candidateId
  const privacyScope = optionalOneOf(r.privacyScope, PRIVACY_SCOPES)
  if (privacyScope !== undefined) block.privacyScope = privacyScope
  const workMode = optionalOneOf(r.workMode, JOB_MODES)
  if (workMode !== undefined) block.workMode = workMode
  const authorityRef = optionalStr(r.authorityRef)
  if (authorityRef !== undefined) block.authorityRef = authorityRef
  if (r.closure !== null && r.closure !== undefined) {
    const closureRecord = record(r.closure)
    block.closure = {
      readbackEvidenceRefs: stringArray(closureRecord.readbackEvidenceRefs),
      executedAt: optionalStr(closureRecord.executedAt),
      receiptRef: optionalStr(closureRecord.receiptRef),
      lessonRef: optionalStr(closureRecord.lessonRef),
    }
  }
  return block
}

// ---- DB row → record mappers ----

function captureRowToRecord(row: Record<string, unknown>): CaptureEvent {
  return {
    id: str(row.id),
    personId: str(row.person_id),
    privacyScope: oneOf(row.privacy_scope, PRIVACY_SCOPES),
    kind: oneOf(row.kind, CAPTURE_KINDS),
    statedText: str(row.stated_text),
    source: oneOf(row.source, CAPTURE_SOURCES),
    occurredAt: timestamp(row.occurred_at),
    capturedAt: timestamp(row.captured_at),
    capturedBy: str(row.captured_by),
    evidenceRefs: stringArray(row.evidence_refs),
    unknowns: stringArray(row.unknowns),
  }
}

function candidateRowToRecord(row: Record<string, unknown>): CandidateRecord {
  const candidate: CandidateRecord = {
    id: str(row.id),
    personId: str(row.person_id),
    privacyScope: oneOf(row.privacy_scope, PRIVACY_SCOPES),
    proposedBy: str(row.proposed_by),
    opportunity: sanitizeOpportunity(row.opportunity),
    version: integer(row.version),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  }
  const sourceCaptureId = optionalStr(row.source_capture_id)
  if (sourceCaptureId !== undefined) candidate.sourceCaptureId = sourceCaptureId
  const decision = sanitizeDecision(row.decision)
  if (decision !== undefined) candidate.decision = decision
  return candidate
}

function taskRowToRecord(row: Record<string, unknown>): TaskRecord {
  const task: TaskRecord = {
    id: str(row.id),
    personId: str(row.person_id),
    privacyScope: oneOf(row.privacy_scope, PRIVACY_SCOPES),
    candidateId: str(row.candidate_id),
    block: sanitizeFamilyBlock(row.block),
    workState: oneOf(row.work_state, WORK_STATES),
    version: integer(row.version),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  }
  const authorityRef = optionalStr(row.authority_ref)
  if (authorityRef !== undefined) task.authorityRef = authorityRef
  return task
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === '23505')
}

/** Maps an INSERT failure to the right domain error. A unique-violation on the
 * `candidateUniqueConstraint` (when given) means a Task already exists for that Candidate —
 * distinct from an ordinary primary-key collision. Anything that isn't a unique-violation is
 * rethrown completely unchanged. */
function throwInsertError(error: unknown, candidateUniqueConstraint?: string): never {
  if (isUniqueViolation(error)) {
    const constraint = (error as { constraint?: unknown }).constraint
    if (candidateUniqueConstraint && constraint === candidateUniqueConstraint) {
      throw new Error('LIFECYCLE_CANDIDATE_ALREADY_TASKED')
    }
    throw new Error('LIFECYCLE_DUPLICATE_ID')
  }
  throw error
}

const TASK_CANDIDATE_ID_CONSTRAINT = 'lifecycle_task_candidate_id_key'

/** Injectable-query Postgres implementation. Every list query filters `privacy_scope = ANY($n)`
 * and orders by its timestamp DESC, id ASC (a deterministic tiebreak for equal timestamps); every
 * by-id read filters `person_id = $n AND privacy_scope = ANY($n)` too. An empty scopes array
 * short-circuits to `[]` / `null` without ever reaching the database (fail closed). */
export function createPostgresLifecycleStore(input: { query: LifecycleQueryFn }): LifecycleStore {
  const { query } = input

  async function putCapture(capture: CaptureEvent): Promise<void> {
    try {
      await query(
        `INSERT INTO lifecycle_capture
          (id, person_id, privacy_scope, kind, stated_text, source, occurred_at, captured_at, captured_by, evidence_refs, unknowns)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          capture.id,
          capture.personId,
          capture.privacyScope,
          capture.kind,
          capture.statedText,
          capture.source,
          capture.occurredAt,
          capture.capturedAt,
          capture.capturedBy,
          JSON.stringify(capture.evidenceRefs ?? []),
          JSON.stringify(capture.unknowns ?? []),
        ],
      )
    } catch (error) {
      throwInsertError(error)
    }
  }

  async function getCapture(input: LifecycleByIdInput): Promise<CaptureEvent | null> {
    if (input.scopes.length === 0) return null
    const result = await query(
      'SELECT * FROM lifecycle_capture WHERE id = $1 AND person_id = $2 AND privacy_scope = ANY($3)',
      [input.id, input.personId, input.scopes],
    )
    const row = result.rows[0]
    return row ? captureRowToRecord(row) : null
  }

  async function listCaptures(input: {
    personId: string
    scopes: PrivacyScope[]
    limit?: number
  }): Promise<CaptureEvent[]> {
    const limit = clampLimit(input.limit)
    if (input.scopes.length === 0) return []
    const result = await query(
      `SELECT * FROM lifecycle_capture
       WHERE person_id = $1 AND privacy_scope = ANY($2)
       ORDER BY captured_at DESC, id ASC
       LIMIT $3`,
      [input.personId, input.scopes, limit],
    )
    return result.rows.map(captureRowToRecord)
  }

  async function insertCandidate(candidate: CandidateRecord): Promise<void> {
    try {
      await query(
        `INSERT INTO lifecycle_candidate
          (id, person_id, privacy_scope, source_capture_id, proposed_by, opportunity, decision, version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          candidate.id,
          candidate.personId,
          candidate.privacyScope,
          candidate.sourceCaptureId ?? null,
          candidate.proposedBy,
          JSON.stringify(candidate.opportunity),
          candidate.decision ? JSON.stringify(candidate.decision) : null,
          candidate.version,
          candidate.createdAt,
          candidate.updatedAt,
        ],
      )
    } catch (error) {
      throwInsertError(error)
    }
  }

  async function updateCandidate(candidate: CandidateRecord, expectedVersion: number): Promise<void> {
    const result = await query(
      `UPDATE lifecycle_candidate
       SET person_id = $1, privacy_scope = $2, source_capture_id = $3, proposed_by = $4,
           opportunity = $5, decision = $6, version = $7, updated_at = $8
       WHERE id = $9 AND version = $10`,
      [
        candidate.personId,
        candidate.privacyScope,
        candidate.sourceCaptureId ?? null,
        candidate.proposedBy,
        JSON.stringify(candidate.opportunity),
        candidate.decision ? JSON.stringify(candidate.decision) : null,
        expectedVersion + 1,
        candidate.updatedAt,
        candidate.id,
        expectedVersion,
      ],
    )
    if (!result.rowCount) throw new Error('LIFECYCLE_VERSION_CONFLICT')
  }

  async function getCandidate(input: LifecycleByIdInput): Promise<CandidateRecord | null> {
    if (input.scopes.length === 0) return null
    const result = await query(
      'SELECT * FROM lifecycle_candidate WHERE id = $1 AND person_id = $2 AND privacy_scope = ANY($3)',
      [input.id, input.personId, input.scopes],
    )
    const row = result.rows[0]
    return row ? candidateRowToRecord(row) : null
  }

  async function listCandidates(input: {
    personId: string
    scopes: PrivacyScope[]
    limit?: number
  }): Promise<CandidateRecord[]> {
    const limit = clampLimit(input.limit)
    if (input.scopes.length === 0) return []
    const result = await query(
      `SELECT * FROM lifecycle_candidate
       WHERE person_id = $1 AND privacy_scope = ANY($2)
       ORDER BY updated_at DESC, id ASC
       LIMIT $3`,
      [input.personId, input.scopes, limit],
    )
    return result.rows.map(candidateRowToRecord)
  }

  async function insertTask(task: TaskRecord): Promise<void> {
    try {
      await query(
        `INSERT INTO lifecycle_task
          (id, person_id, privacy_scope, candidate_id, block, work_state, authority_ref, version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          task.id,
          task.personId,
          task.privacyScope,
          task.candidateId,
          JSON.stringify(task.block),
          task.workState,
          task.authorityRef ?? null,
          task.version,
          task.createdAt,
          task.updatedAt,
        ],
      )
    } catch (error) {
      throwInsertError(error, TASK_CANDIDATE_ID_CONSTRAINT)
    }
  }

  async function updateTask(task: TaskRecord, expectedVersion: number): Promise<void> {
    const result = await query(
      `UPDATE lifecycle_task
       SET person_id = $1, privacy_scope = $2, candidate_id = $3, block = $4,
           work_state = $5, authority_ref = $6, version = $7, updated_at = $8
       WHERE id = $9 AND version = $10`,
      [
        task.personId,
        task.privacyScope,
        task.candidateId,
        JSON.stringify(task.block),
        task.workState,
        task.authorityRef ?? null,
        expectedVersion + 1,
        task.updatedAt,
        task.id,
        expectedVersion,
      ],
    )
    if (!result.rowCount) throw new Error('LIFECYCLE_VERSION_CONFLICT')
  }

  async function getTask(input: LifecycleByIdInput): Promise<TaskRecord | null> {
    if (input.scopes.length === 0) return null
    const result = await query(
      'SELECT * FROM lifecycle_task WHERE id = $1 AND person_id = $2 AND privacy_scope = ANY($3)',
      [input.id, input.personId, input.scopes],
    )
    const row = result.rows[0]
    return row ? taskRowToRecord(row) : null
  }

  async function listTasks(input: {
    personId: string
    scopes: PrivacyScope[]
    workStates?: WorkState[]
    limit?: number
  }): Promise<TaskRecord[]> {
    const limit = clampLimit(input.limit)
    if (input.scopes.length === 0) return []
    if (input.workStates && input.workStates.length > 0) {
      const result = await query(
        `SELECT * FROM lifecycle_task
         WHERE person_id = $1 AND privacy_scope = ANY($2) AND work_state = ANY($3)
         ORDER BY updated_at DESC, id ASC
         LIMIT $4`,
        [input.personId, input.scopes, input.workStates, limit],
      )
      return result.rows.map(taskRowToRecord)
    }
    const result = await query(
      `SELECT * FROM lifecycle_task
       WHERE person_id = $1 AND privacy_scope = ANY($2)
       ORDER BY updated_at DESC, id ASC
       LIMIT $3`,
      [input.personId, input.scopes, limit],
    )
    return result.rows.map(taskRowToRecord)
  }

  return {
    putCapture,
    getCapture,
    listCaptures,
    insertCandidate,
    updateCandidate,
    getCandidate,
    listCandidates,
    insertTask,
    updateTask,
    getTask,
    listTasks,
  }
}

const activePools = new Set<PgPool>()

/** Builds a real Postgres-backed store from env, or `null` when neither URL is configured.
 * `pg` is imported dynamically — and only on the first query — so this module (and calling it
 * with no URL) never requires `pg` to be resolvable, e.g. in an edge runtime.
 *
 * TLS is not configured here at all: it is controlled entirely by the injected URL's own
 * `sslmode` (a Neon pooled connection string already sets `sslmode=require`). Note that pg
 * currently treats `sslmode=require` as `verify-full` — it does validate the server certificate —
 * not as an unauthenticated opportunistic-TLS mode. */
export function createLifecycleStoreFromEnv(env: {
  DATABASE_URL?: string
  POSTGRES_URL?: string
}): LifecycleStore | null {
  const connectionString = env.DATABASE_URL?.trim() || env.POSTGRES_URL?.trim()
  if (!connectionString) return null

  let pool: PgPool | null = null
  const query: LifecycleQueryFn = async (text, params) => {
    if (!pool) {
      const { Pool } = await import('pg')
      pool = new Pool({
        connectionString,
        max: 2,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 5_000,
      })
      activePools.add(pool)
    }
    return pool.query(text, params)
  }

  return createPostgresLifecycleStore({ query })
}

/** Ends every pool created by `createLifecycleStoreFromEnv` so far — for tests and graceful
 * process shutdown. Safe to call even when no pool was ever created. */
export async function closeLifecycleStorePool(): Promise<void> {
  const pools = [...activePools]
  activePools.clear()
  await Promise.all(pools.map((pool) => pool.end()))
}

/** In-memory implementation with the same contract (incl. optimistic-concurrency version
 * conflicts, the candidate-id-already-tasked guard, and fail-closed empty-scope reads) — for
 * tests and A3 route tests. */
export function createMemoryLifecycleStore(): LifecycleStore {
  const captures = new Map<string, CaptureEvent>()
  const candidates = new Map<string, CandidateRecord>()
  const tasks = new Map<string, TaskRecord>()
  const tasksByCandidateId = new Set<string>()

  function clone<T>(value: T): T {
    return structuredClone(value)
  }

  function sortByTimestampDescThenIdAsc<T extends { id: string }>(items: T[], timestampOf: (item: T) => string): T[] {
    return items.sort((a, b) => timestampOf(b).localeCompare(timestampOf(a)) || a.id.localeCompare(b.id))
  }

  async function putCapture(capture: CaptureEvent): Promise<void> {
    if (captures.has(capture.id)) throw new Error('LIFECYCLE_DUPLICATE_ID')
    captures.set(capture.id, clone(capture))
  }

  async function getCapture(input: LifecycleByIdInput): Promise<CaptureEvent | null> {
    if (input.scopes.length === 0) return null
    const found = captures.get(input.id)
    if (!found || found.personId !== input.personId) return null
    if (!input.scopes.includes(found.privacyScope)) return null
    return clone(found)
  }

  async function listCaptures(input: {
    personId: string
    scopes: PrivacyScope[]
    limit?: number
  }): Promise<CaptureEvent[]> {
    const limit = clampLimit(input.limit)
    if (input.scopes.length === 0) return []
    const scopeSet = new Set(input.scopes)
    const matches = sortByTimestampDescThenIdAsc(
      [...captures.values()].filter((item) => item.personId === input.personId && scopeSet.has(item.privacyScope)),
      (item) => item.capturedAt,
    )
    return matches.slice(0, limit).map(clone)
  }

  async function insertCandidate(candidate: CandidateRecord): Promise<void> {
    if (candidates.has(candidate.id)) throw new Error('LIFECYCLE_DUPLICATE_ID')
    candidates.set(candidate.id, clone(candidate))
  }

  async function updateCandidate(candidate: CandidateRecord, expectedVersion: number): Promise<void> {
    const existing = candidates.get(candidate.id)
    if (!existing || existing.version !== expectedVersion) throw new Error('LIFECYCLE_VERSION_CONFLICT')
    candidates.set(candidate.id, clone({ ...candidate, version: expectedVersion + 1 }))
  }

  async function getCandidate(input: LifecycleByIdInput): Promise<CandidateRecord | null> {
    if (input.scopes.length === 0) return null
    const found = candidates.get(input.id)
    if (!found || found.personId !== input.personId) return null
    if (!input.scopes.includes(found.privacyScope)) return null
    return clone(found)
  }

  async function listCandidates(input: {
    personId: string
    scopes: PrivacyScope[]
    limit?: number
  }): Promise<CandidateRecord[]> {
    const limit = clampLimit(input.limit)
    if (input.scopes.length === 0) return []
    const scopeSet = new Set(input.scopes)
    const matches = sortByTimestampDescThenIdAsc(
      [...candidates.values()].filter((item) => item.personId === input.personId && scopeSet.has(item.privacyScope)),
      (item) => item.updatedAt,
    )
    return matches.slice(0, limit).map(clone)
  }

  async function insertTask(task: TaskRecord): Promise<void> {
    if (tasks.has(task.id)) throw new Error('LIFECYCLE_DUPLICATE_ID')
    if (tasksByCandidateId.has(task.candidateId)) throw new Error('LIFECYCLE_CANDIDATE_ALREADY_TASKED')
    tasks.set(task.id, clone(task))
    tasksByCandidateId.add(task.candidateId)
  }

  async function updateTask(task: TaskRecord, expectedVersion: number): Promise<void> {
    const existing = tasks.get(task.id)
    if (!existing || existing.version !== expectedVersion) throw new Error('LIFECYCLE_VERSION_CONFLICT')
    tasks.set(task.id, clone({ ...task, version: expectedVersion + 1 }))
  }

  async function getTask(input: LifecycleByIdInput): Promise<TaskRecord | null> {
    if (input.scopes.length === 0) return null
    const found = tasks.get(input.id)
    if (!found || found.personId !== input.personId) return null
    if (!input.scopes.includes(found.privacyScope)) return null
    return clone(found)
  }

  async function listTasks(input: {
    personId: string
    scopes: PrivacyScope[]
    workStates?: WorkState[]
    limit?: number
  }): Promise<TaskRecord[]> {
    const limit = clampLimit(input.limit)
    if (input.scopes.length === 0) return []
    const scopeSet = new Set(input.scopes)
    const workStateSet = input.workStates && input.workStates.length > 0 ? new Set(input.workStates) : null
    const matches = sortByTimestampDescThenIdAsc(
      [...tasks.values()]
        .filter((item) => item.personId === input.personId && scopeSet.has(item.privacyScope))
        .filter((item) => !workStateSet || workStateSet.has(item.workState)),
      (item) => item.updatedAt,
    )
    return matches.slice(0, limit).map(clone)
  }

  return {
    putCapture,
    getCapture,
    listCaptures,
    insertCandidate,
    updateCandidate,
    getCandidate,
    listCandidates,
    insertTask,
    updateTask,
    getTask,
    listTasks,
  }
}
