import type { CaptureEvent } from './lifecycle.ts'
import type { EvidenceRef, EvidenceState, PrivacyScope } from './contracts.ts'
import type { ArtifactObservationInput } from './artifact-registry.ts'

/**
 * Unit 31 — Drive handoff intake. Pure, deterministic mapping from the Drive-side
 * `DORANDORAN_HANDOFF_TEMPLATE` record (as produced by GPT/Gemini/Grok/Claude/JDK/KINGDOM/HyoDo,
 * or a human) into Unit 28's `CaptureEvent` and, when the record is a `final_artifact` with a
 * digest, Unit 30's `ArtifactObservationInput`. No I/O, no wall clock, no persistence. Nothing
 * here creates a Candidate decision or a Task — see Unit 28 for `proposeCandidate`/`decideCandidate`.
 */

export type DrivePerson = 'jay' | 'julie' | 'jayden' | 'family'
export type DriveDomain = 'career' | 'music' | 'kingdom' | 'family' | 'learning' | 'school' | 'admin' | 'other'
export type DriveKind =
  | 'capture'
  | 'decision'
  | 'final_artifact'
  | 'task_receipt'
  | 'learning_event'
  | 'calendar_change'
  | 'source_update'
export type DriveStatus = 'candidate' | 'reviewed' | 'final' | 'superseded' | 'archived' | 'informational'
export type DriveSourceSystem =
  | 'chatgpt'
  | 'gemini'
  | 'grok'
  | 'claude'
  | 'drive'
  | 'calendar'
  | 'jdk'
  | 'kingdom'
  | 'hyodo'
  | 'human'
export type DriveRequestedAction = 'none' | 'review' | 'accept_candidate' | 'schedule' | 'archive' | 'supersede'

/** The validated shape of a `DORANDORAN_HANDOFF_TEMPLATE` record — every field here has already
 * passed `parseDorandoranHandoff`'s fail-closed checks. Unknown extra fields on the raw input are
 * dropped; they never reach this type. */
export interface DorandoranHandoffRecord {
  eventId: string
  occurredAt: string
  person: DrivePerson
  domain: DriveDomain
  kind: DriveKind
  privacyScope: PrivacyScope
  status: DriveStatus
  sourceSystem: DriveSourceSystem
  sourceRefs: string[]
  driveFileId?: string
  digest?: string
  evidenceRefs: string[]
  statedText: string
  inference?: string
  unknowns: string[]
  candidateSuggested: boolean
  requestedAction: DriveRequestedAction
  notes?: string
}

export type HandoffRejectCode =
  | 'FIELD_MISSING'
  | 'FIELD_INVALID'
  | 'ACCEPT_BY_AI_FORBIDDEN'
  | 'PRIVACY_PERSON_MISMATCH'
  | 'SECRET_LIKE_CONTENT'

/** Kept verbatim for reconciliation with the Drive side; never used to decide anything in this unit. */
export interface HandoffProvenance {
  sourceSystem: DriveSourceSystem
  domain: DriveDomain
  sourceRefs: string[]
  driveFileId?: string
  status: DriveStatus
  requestedAction: DriveRequestedAction
  notes?: string
}

export interface HandoffIntake {
  capture: CaptureEvent
  proposeCandidate: boolean
  artifact: ArtifactObservationInput | null
  inference: string | null
  provenance: HandoffProvenance
}

export type HandoffParseResult = { ok: true; intake: HandoffIntake } | { ok: false; code: HandoffRejectCode; field?: string }

// ---- mapping tables ----

/** Drive `kind` → Unit 28 `CaptureEvent['kind']`. `capture` is conditional on `candidateSuggested`
 * (`want` when suggested, `fact` otherwise — see `parseDorandoranHandoff`) and is therefore not a
 * fixed entry in this table. */
export const DRIVE_KIND_TO_CAPTURE_KIND: Record<Exclude<DriveKind, 'capture'>, CaptureEvent['kind']> = {
  decision: 'decision',
  final_artifact: 'final_artifact',
  task_receipt: 'fact',
  learning_event: 'fact',
  calendar_change: 'fact',
  source_update: 'fact',
}

/** Drive `sourceSystem` → `EvidenceRef['sourceType']`. */
export const DRIVE_SOURCE_TO_EVIDENCE_SOURCE_TYPE: Record<DriveSourceSystem, EvidenceRef['sourceType']> = {
  drive: 'file',
  calendar: 'calendar',
  human: 'human',
  chatgpt: 'system',
  gemini: 'system',
  grok: 'system',
  claude: 'system',
  jdk: 'system',
  kingdom: 'system',
  hyodo: 'system',
}

/** Drive `status` → the artifact observation's `EvidenceState`. `confirmed` only for `final`;
 * `superseded | archived` → `stale`; everything else (`candidate | reviewed | informational`) → `unknown`. */
export const DRIVE_STATUS_TO_ARTIFACT_STATE: Record<DriveStatus, EvidenceState> = {
  final: 'confirmed',
  reviewed: 'unknown',
  candidate: 'unknown',
  informational: 'unknown',
  superseded: 'stale',
  archived: 'stale',
}

// ---- validation ----

const DRIVE_PERSONS: readonly DrivePerson[] = ['jay', 'julie', 'jayden', 'family']
const DRIVE_DOMAINS: readonly DriveDomain[] = [
  'career', 'music', 'kingdom', 'family', 'learning', 'school', 'admin', 'other',
]
const DRIVE_KINDS: readonly DriveKind[] = [
  'capture', 'decision', 'final_artifact', 'task_receipt', 'learning_event', 'calendar_change', 'source_update',
]
const PRIVACY_SCOPES: readonly PrivacyScope[] = ['personal', 'family', 'professional']
const DRIVE_STATUSES: readonly DriveStatus[] = [
  'candidate', 'reviewed', 'final', 'superseded', 'archived', 'informational',
]
const DRIVE_SOURCE_SYSTEMS: readonly DriveSourceSystem[] = [
  'chatgpt', 'gemini', 'grok', 'claude', 'drive', 'calendar', 'jdk', 'kingdom', 'hyodo', 'human',
]
const DRIVE_REQUESTED_ACTIONS: readonly DriveRequestedAction[] = [
  'none', 'review', 'accept_candidate', 'schedule', 'archive', 'supersede',
]

const ACTIONABLE_CAPTURE_KINDS = new Set<CaptureEvent['kind']>(['want', 'decision', 'final_artifact'])

// AIza… (Google API key), sk-…/sk_live_… (OpenAI/Stripe-style key), ya29.… (Google OAuth token),
// AKIA… (AWS access key id), -----BEGIN (PEM block), password=/passwd=. Each key-shaped prefix
// carries a `(?<![\w-])` left boundary so it only matches at the start of a token — never mid-word
// — which is what keeps ordinary words like "task-1234567890", "desk-9876543210", and
// "risk-4455667788" from false-positiving on the "sk-" prefix.
const SECRET_LIKE_PATTERN =
  /(?<![\w-])sk[-_][\w-]{10,}|(?<![\w-])AIza[\w-]{10,}|(?<![\w-])ya29\.[\w.-]{10,}|(?<![\w-])AKIA[0-9A-Z]{16}|-----BEGIN|password\s*=|passwd\s*=/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

/** `undefined`/`null` is a missing field; anything else that fails validation is the wrong shape. */
function missingOrInvalid(raw: unknown): 'FIELD_MISSING' | 'FIELD_INVALID' {
  return raw === undefined || raw === null ? 'FIELD_MISSING' : 'FIELD_INVALID'
}

function looksSecretLike(value: string): boolean {
  return SECRET_LIKE_PATTERN.test(value)
}

// Drive 계약이 명명한 유일한 다이제스트 형식(`digest: sha256:<hex>`). 소문자 hex 64자만 받는다 —
// 계약이 알고리즘을 하나만 지목했으므로 여기서 둘째를 받으면 계약보다 앞서 나가는 것이 된다.
const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/

// Strict ISO-8601 instant shape (date + time + zone). Rejects human-readable dates like
// "March 5, 2026" or ambiguous ones like "03/05/2026" that `Date.parse` would otherwise accept.
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/

function isIso8601(value: string): boolean {
  return ISO_8601_PATTERN.test(value) && Number.isFinite(Date.parse(value))
}

/** Absent is fine (`undefined`); present-but-empty or whitespace-only fails closed as `FIELD_INVALID`
 * rather than being silently treated as absent. */
function readOptionalString(record: Record<string, unknown>, field: string): { ok: true; value: string | undefined } | { ok: false } {
  const raw = record[field]
  if (raw === undefined) return { ok: true, value: undefined }
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false }
  return { ok: true, value: raw }
}

function readStringArray(record: Record<string, unknown>, field: string): { ok: true; value: string[] } | { ok: false } {
  const raw = record[field]
  if (raw === undefined) return { ok: true, value: [] }
  if (!Array.isArray(raw) || !raw.every((item) => typeof item === 'string')) return { ok: false }
  return { ok: true, value: [...raw] as string[] }
}

/**
 * Validates and maps an unknown Drive handoff record into a `HandoffIntake`. Fails closed on any
 * missing/wrong-typed/out-of-enum field, on AI attempting `accept_candidate`, on a `person: 'family'`
 * record without `privacyScope: 'family'`, and on credential-shaped text in `statedText`/`inference`/`notes`.
 * `context.capturedBy`/`context.capturedAt` are this caller's own identity/clock (Unit 28
 * `CaptureEvent` fields) — never read from the Drive record itself.
 */
export function parseDorandoranHandoff(
  input: unknown,
  context: { capturedBy: string; capturedAt: string },
): HandoffParseResult {
  const fail = (code: HandoffRejectCode, field?: string): HandoffParseResult =>
    field === undefined ? { ok: false, code } : { ok: false, code, field }

  if (!isRecord(input)) return fail('FIELD_MISSING')
  const record = input

  if (typeof context.capturedBy !== 'string' || context.capturedBy.trim() === '') {
    return fail('FIELD_INVALID', 'capturedBy')
  }
  if (typeof context.capturedAt !== 'string' || !isIso8601(context.capturedAt)) {
    return fail('FIELD_INVALID', 'capturedAt')
  }

  const eventIdRaw = record.eventId
  if (typeof eventIdRaw !== 'string' || eventIdRaw.trim() === '') return fail(missingOrInvalid(eventIdRaw), 'eventId')
  const eventId = eventIdRaw

  const occurredAtRaw = record.occurredAt
  if (typeof occurredAtRaw !== 'string' || occurredAtRaw.trim() === '') {
    return fail(missingOrInvalid(occurredAtRaw), 'occurredAt')
  }
  if (!isIso8601(occurredAtRaw)) return fail('FIELD_INVALID', 'occurredAt')
  const occurredAt = occurredAtRaw

  const personRaw = record.person
  if (!isOneOf(personRaw, DRIVE_PERSONS)) return fail(missingOrInvalid(personRaw), 'person')
  const person = personRaw

  const domainRaw = record.domain
  if (!isOneOf(domainRaw, DRIVE_DOMAINS)) return fail(missingOrInvalid(domainRaw), 'domain')
  const domain = domainRaw

  const kindRaw = record.kind
  if (!isOneOf(kindRaw, DRIVE_KINDS)) return fail(missingOrInvalid(kindRaw), 'kind')
  const kind = kindRaw

  const privacyScopeRaw = record.privacyScope
  if (!isOneOf(privacyScopeRaw, PRIVACY_SCOPES)) return fail(missingOrInvalid(privacyScopeRaw), 'privacyScope')
  const privacyScope = privacyScopeRaw

  const statusRaw = record.status
  if (!isOneOf(statusRaw, DRIVE_STATUSES)) return fail(missingOrInvalid(statusRaw), 'status')
  const status = statusRaw

  const sourceSystemRaw = record.sourceSystem
  if (!isOneOf(sourceSystemRaw, DRIVE_SOURCE_SYSTEMS)) return fail(missingOrInvalid(sourceSystemRaw), 'sourceSystem')
  const sourceSystem = sourceSystemRaw

  const sourceRefsResult = readStringArray(record, 'sourceRefs')
  if (!sourceRefsResult.ok) return fail('FIELD_INVALID', 'sourceRefs')
  const sourceRefs = sourceRefsResult.value

  const driveFileIdResult = readOptionalString(record, 'driveFileId')
  if (!driveFileIdResult.ok) return fail('FIELD_INVALID', 'driveFileId')
  const driveFileId = driveFileIdResult.value

  const digestResult = readOptionalString(record, 'digest')
  if (!digestResult.ok) return fail('FIELD_INVALID', 'digest')
  // 계약이 요구하는 것은 존재가 아니라 유효성이다. 형식이 어긋난 digest 를 통과시키면 Unit 30 registry 가
  // "무효한 해시로 confirmed 된 아티팩트" 를 갖게 된다. 보낸 쪽이 digest 를 주장했는데 틀린 것이므로
  // artifact 만 조용히 빼지 않고 레코드 전체를 거부한다 — 조용히 빼면 provenance 가 주장을 잃는다.
  if (digestResult.value !== undefined && !SHA256_DIGEST_PATTERN.test(digestResult.value)) {
    return fail('FIELD_INVALID', 'digest')
  }
  const digest = digestResult.value

  const evidenceRefsResult = readStringArray(record, 'evidenceRefs')
  if (!evidenceRefsResult.ok) return fail('FIELD_INVALID', 'evidenceRefs')
  const evidenceRefs = evidenceRefsResult.value

  const statedTextRaw = record.statedText
  if (typeof statedTextRaw !== 'string' || statedTextRaw.trim() === '') {
    return fail(missingOrInvalid(statedTextRaw), 'statedText')
  }
  const statedText = statedTextRaw

  const inferenceResult = readOptionalString(record, 'inference')
  if (!inferenceResult.ok) return fail('FIELD_INVALID', 'inference')
  const inference = inferenceResult.value

  const unknownsResult = readStringArray(record, 'unknowns')
  if (!unknownsResult.ok) return fail('FIELD_INVALID', 'unknowns')
  const unknowns = unknownsResult.value

  const candidateSuggestedRaw = record.candidateSuggested
  if (typeof candidateSuggestedRaw !== 'boolean') return fail(missingOrInvalid(candidateSuggestedRaw), 'candidateSuggested')
  const candidateSuggested = candidateSuggestedRaw

  const requestedActionRaw = record.requestedAction
  if (!isOneOf(requestedActionRaw, DRIVE_REQUESTED_ACTIONS)) {
    return fail(missingOrInvalid(requestedActionRaw), 'requestedAction')
  }
  const requestedAction = requestedActionRaw

  const notesResult = readOptionalString(record, 'notes')
  if (!notesResult.ok) return fail('FIELD_INVALID', 'notes')
  const notes = notesResult.value

  const validated: DorandoranHandoffRecord = {
    eventId, occurredAt, person, domain, kind, privacyScope, status, sourceSystem,
    sourceRefs, driveFileId, digest, evidenceRefs, statedText, inference, unknowns,
    candidateSuggested, requestedAction, notes,
  }

  // ---- fail-closed business rules ----

  if (validated.person === 'family' && validated.privacyScope !== 'family') {
    return fail('PRIVACY_PERSON_MISMATCH', 'privacyScope')
  }

  if (validated.requestedAction === 'accept_candidate' && validated.sourceSystem !== 'human') {
    return fail('ACCEPT_BY_AI_FORBIDDEN', 'sourceSystem')
  }

  if (looksSecretLike(validated.statedText)) return fail('SECRET_LIKE_CONTENT', 'statedText')
  if (validated.inference !== undefined && looksSecretLike(validated.inference)) {
    return fail('SECRET_LIKE_CONTENT', 'inference')
  }
  if (validated.notes !== undefined && looksSecretLike(validated.notes)) return fail('SECRET_LIKE_CONTENT', 'notes')

  // ---- mapping ----

  const mappedKind: CaptureEvent['kind'] =
    validated.kind === 'capture'
      ? validated.candidateSuggested ? 'want' : 'fact'
      : DRIVE_KIND_TO_CAPTURE_KIND[validated.kind]

  // proposeCandidate = ACTIONABLE(mappedKind) && (candidateSuggested === true ||
  //   (sourceSystem === 'human' && requestedAction === 'accept_candidate')).
  // The mapped kind must be actionable regardless of who is asking — a human `accept_candidate`
  // on a non-actionable kind (e.g. `task_receipt`) still yields `proposeCandidate: false`; the
  // request is preserved verbatim in `provenance.requestedAction` for a reviewer to see. AI can
  // never reach the human-only disjunct here (rejected above as ACCEPT_BY_AI_FORBIDDEN).
  const proposeCandidateFlag =
    ACTIONABLE_CAPTURE_KINDS.has(mappedKind) &&
    (validated.candidateSuggested || (validated.sourceSystem === 'human' && validated.requestedAction === 'accept_candidate'))

  const capture: CaptureEvent = {
    id: validated.eventId,
    personId: validated.person,
    privacyScope: validated.privacyScope,
    kind: mappedKind,
    statedText: validated.statedText,
    source: DRIVE_SOURCE_TO_EVIDENCE_SOURCE_TYPE[validated.sourceSystem],
    occurredAt: validated.occurredAt,
    capturedAt: context.capturedAt,
    capturedBy: context.capturedBy,
    evidenceRefs: validated.evidenceRefs,
    unknowns: validated.unknowns,
  }

  const artifact: ArtifactObservationInput | null =
    validated.kind === 'final_artifact' && validated.driveFileId !== undefined && validated.digest !== undefined
      ? {
          id: validated.driveFileId,
          kind: validated.domain,
          digest: validated.digest,
          observedAt: validated.occurredAt,
          state: DRIVE_STATUS_TO_ARTIFACT_STATE[validated.status],
          provenance: { sourceRef: validated.driveFileId, evidenceRefs: validated.evidenceRefs },
        }
      : null

  const provenance: HandoffProvenance = {
    sourceSystem: validated.sourceSystem,
    domain: validated.domain,
    sourceRefs: validated.sourceRefs,
    driveFileId: validated.driveFileId,
    status: validated.status,
    requestedAction: validated.requestedAction,
    notes: validated.notes,
  }

  return {
    ok: true,
    intake: {
      capture,
      proposeCandidate: proposeCandidateFlag,
      artifact,
      inference: validated.inference ?? null,
      provenance,
    },
  }
}
