import type { EvidenceRef, JobMode, Opportunity, PrivacyScope, WorkState } from '../family-os/contracts.ts'
import type { CaptureEvent } from '../family-os/lifecycle.ts'
import type { CaptureInput, DecideCandidateInput, TransitionTaskInput } from './lifecycle-service.ts'

// Route-layer body shape guards. Nothing here decides business outcomes (LANE_MISMATCH,
// PRIVACY_SCOPE_DENIED, ...) — a malformed body is only ever BODY_INVALID (400). Everything that
// parses cleanly is handed to the service unchanged. Every bound below exists to keep an
// adversarial body (megabyte-long strings, thousand-item arrays, out-of-range numbers) from ever
// reaching the service or the store — the service enforces its own business-level checks (e.g.
// `statedText` is re-trimmed and re-checked there) independently of these edge bounds.

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
const PRIORITIES: readonly NonNullable<Opportunity['priority']>[] = ['low', 'medium', 'high']
const WORK_STATES: readonly WorkState[] = ['hold', 'open', 'in_progress', 'risk', 'done']
const DECISION_KINDS = ['accept', 'decline'] as const

const STATED_TEXT_MAX = 2000
const TIMESTAMP_MAX_LENGTH = 40
const ESTIMATED_MINUTES_MAX = 1440
const EVIDENCE_LIST_MAX_ITEMS = 50
const EVIDENCE_ITEM_MIN_LENGTH = 1
const EVIDENCE_ITEM_MAX_LENGTH = 200
const EXPECTED_VERSION_MAX = 1_000_000_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

/** A string whose length falls in `[min, max]` — every bound here is inclusive. */
function isBoundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max
}

/** A short (≤40 char) string that also parses as a real instant. Rejects both garbage text and
 * implausibly long strings that would otherwise sail through `Date.parse`. */
function isTimestampLike(value: unknown): value is string {
  return typeof value === 'string' && value.length <= TIMESTAMP_MAX_LENGTH && Number.isFinite(Date.parse(value))
}

/** An array of at most `maxItems` strings, each `[itemMin, itemMax]` characters long. */
function isBoundedStringArray(value: unknown, maxItems: number, itemMin: number, itemMax: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => isBoundedString(item, itemMin, itemMax))
  )
}

/** An integer in `[min, max]` (inclusive both ends). */
function isBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

function isEvidenceList(value: unknown): value is string[] {
  return isBoundedStringArray(value, EVIDENCE_LIST_MAX_ITEMS, EVIDENCE_ITEM_MIN_LENGTH, EVIDENCE_ITEM_MAX_LENGTH)
}

function isExpectedVersion(value: unknown): value is number {
  return isBoundedInteger(value, 1, EXPECTED_VERSION_MAX)
}

export function parseCaptureBody(body: unknown): CaptureInput | null {
  if (!isRecord(body)) return null
  if (body.personId !== undefined && !isString(body.personId)) return null
  if (!isOneOf(body.privacyScope, PRIVACY_SCOPES)) return null
  if (!isOneOf(body.kind, CAPTURE_KINDS)) return null
  if (!isBoundedString(body.statedText, 1, STATED_TEXT_MAX)) return null
  if (!isOneOf(body.source, CAPTURE_SOURCES)) return null
  if (body.occurredAt !== undefined && !isTimestampLike(body.occurredAt)) return null
  if (body.evidenceRefs !== undefined && !isEvidenceList(body.evidenceRefs)) return null
  if (body.unknowns !== undefined && !isEvidenceList(body.unknowns)) return null

  let propose: CaptureInput['propose']
  if (body.propose !== undefined) {
    if (!isRecord(body.propose)) return null
    if (!isOneOf(body.propose.mode, JOB_MODES)) return null
    if (
      body.propose.estimatedMinutes !== undefined &&
      !isBoundedInteger(body.propose.estimatedMinutes, 0, ESTIMATED_MINUTES_MAX)
    ) {
      return null
    }
    if (body.propose.priority !== undefined && !isOneOf(body.propose.priority, PRIORITIES)) return null
    propose = {
      mode: body.propose.mode,
      estimatedMinutes: body.propose.estimatedMinutes as number | undefined,
      priority: body.propose.priority as Opportunity['priority'],
    }
  }

  return {
    personId: body.personId as string | undefined,
    privacyScope: body.privacyScope,
    kind: body.kind,
    statedText: body.statedText,
    source: body.source,
    occurredAt: body.occurredAt as string | undefined,
    evidenceRefs: body.evidenceRefs as string[] | undefined,
    unknowns: body.unknowns as string[] | undefined,
    propose,
  }
}

export function parseDecideBody(body: unknown): Omit<DecideCandidateInput, 'candidateId'> | null {
  if (!isRecord(body)) return null
  if (!isString(body.personId)) return null
  if (!isOneOf(body.kind, DECISION_KINDS)) return null
  if (body.note !== undefined && !isString(body.note)) return null
  if (!isExpectedVersion(body.expectedVersion)) return null
  return { personId: body.personId, kind: body.kind, note: body.note, expectedVersion: body.expectedVersion }
}

export function parseTransitionBody(body: unknown): Omit<TransitionTaskInput, 'taskId'> | null {
  if (!isRecord(body)) return null
  if (!isString(body.personId)) return null
  if (!isOneOf(body.next, WORK_STATES)) return null
  if (body.readbackEvidenceRefs !== undefined && !isEvidenceList(body.readbackEvidenceRefs)) return null
  if (!isExpectedVersion(body.expectedVersion)) return null
  return {
    personId: body.personId,
    next: body.next,
    readbackEvidenceRefs: body.readbackEvidenceRefs as string[] | undefined,
    expectedVersion: body.expectedVersion,
  }
}

/** Parses an optional `?limit=` query param into a number, or `undefined` when absent. A
 * non-numeric value becomes `NaN`, which `clampLimit` inside the store rejects as
 * `LIFECYCLE_LIMIT_INVALID` (400) — this function never itself decides validity. */
export function parseLimitParam(value: string | null): number | undefined {
  if (value === null) return undefined
  return Number(value)
}

/** `undefined` = param absent (no filter). `null` = param present but invalid — the caller must
 * reject the request rather than silently drop the filter. */
export function parseWorkStatesParam(value: string | null): WorkState[] | undefined | null {
  if (value === null) return undefined
  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  if (values.length === 0) return null
  return values.every((item) => isOneOf(item, WORK_STATES)) ? (values as WorkState[]) : null
}
