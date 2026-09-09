import { parseDorandoranHandoff, type HandoffIntake, type HandoffRejectCode } from './drive-handoff-intake.ts'

/**
 * Unit 34 — Drive `04_DORANDORAN_OUTBOX` intake. Pure and deterministic: it decides what to
 * read and classifies what was read, but performs no Drive call, no OAuth, no persistence and
 * no scheduling. Unit 31 turns one record into a `CaptureEvent`; this unit is the batch layer
 * around it. Nothing here creates a Candidate decision or a Task — see Unit 28.
 */

/** Provider-neutral outbox file. Vendor payloads reach it through `normalizeDriveOutboxFile`. */
export interface OutboxFile {
  fileId: string
  name: string
  modifiedTime: string
  mimeType: string
}

/** Handoff records are small structured text; anything else in the folder is not ours to read. */
export const DEFAULT_OUTBOX_MIME_TYPES: readonly string[] = [
  'application/vnd.google-apps.document',
  'text/plain',
  'text/markdown',
  'application/json',
]

export type OutboxSkipReason = 'already_processed' | 'unsupported_type' | 'template_file'

/**
 * 핸드오프 템플릿은 설계상 outbox 안에 산다 — 에이전트가 그것을 찾는 곳이 거기다.
 * 따라서 매 실행마다 영원히 목록에 잡힌다. 읽는 것은 애초에 의도된 적이 없다.
 * (2026-09-09 실측: 세 outbox 폴더의 유일한 파일이 각각 이 템플릿이었다.)
 */
const TEMPLATE_NAME_PATTERN = /dorandoran[_\s-]*handoff[_\s-]*template/i

export interface OutboxSkip {
  fileId: string
  reason: OutboxSkipReason
}

export interface OutboxPlan {
  fetch: OutboxFile[]
  skipped: OutboxSkip[]
}

export type OutboxEntryResult =
  | { fileId: string; outcome: 'accepted'; eventId: string; intake: HandoffIntake }
  | { fileId: string; outcome: 'duplicate'; eventId: string }
  | { fileId: string; outcome: 'rejected'; code: HandoffRejectCode; field?: string }

export interface OutboxBatchResult {
  entries: OutboxEntryResult[]
  /** Files this batch consumed — including rejected ones, so a bad file is not re-read forever. */
  processedFileIds: string[]
  /** Record ids newly accepted by this batch. Duplicates contribute nothing. */
  processedEventIds: string[]
}

export interface OutboxBatchEntry {
  file: OutboxFile
  record: unknown
}

// 파일 메타의 시각. Unit 31 의 record 시각과 같은 엄격도를 쓴다 — 사람이 읽는 날짜 문자열을
// Date.parse 가 받아주는 것을 관측 성공으로 착각하지 않는다.
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/

function requiredText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/**
 * Google Drive v3 `files.list` payload → `OutboxFile`.
 *
 * Mirrors `google-calendar-rest-adapter`: the core never learns one vendor's field names.
 * Unobservable input throws rather than being dropped — a file we cannot identify is not
 * the same as a file that is not there.
 */
export function normalizeDriveOutboxFile(payload: {
  id?: unknown
  name?: unknown
  mimeType?: unknown
  modifiedTime?: unknown
}): OutboxFile {
  const fileId = requiredText(payload.id)
  const name = requiredText(payload.name)
  const mimeType = requiredText(payload.mimeType)
  const modifiedTime = requiredText(payload.modifiedTime)
  if (!fileId || !name || !mimeType || !modifiedTime) throw new Error('INVALID_DRIVE_OUTBOX_FILE')
  if (!ISO_8601_PATTERN.test(modifiedTime) || !Number.isFinite(Date.parse(modifiedTime))) {
    throw new Error('INVALID_DRIVE_OUTBOX_FILE')
  }
  return { fileId: fileId.trim(), name, mimeType: mimeType.trim(), modifiedTime }
}

/**
 * Stage 1 — decide what to fetch before paying for a read.
 *
 * An absent `processedFileIds` is an empty set, never "everything processed": a lost cursor
 * must re-ingest (duplicates are caught in stage 2 by `eventId`), because the opposite failure
 * silently drops real handoffs.
 */
export function planDriveOutboxIntake(input: {
  files: readonly OutboxFile[]
  processedFileIds?: readonly string[]
  mimeTypes?: readonly string[]
}): OutboxPlan {
  const processed = new Set(input.processedFileIds ?? [])
  const accepted = new Set(input.mimeTypes ?? DEFAULT_OUTBOX_MIME_TYPES)
  const fetch: OutboxFile[] = []
  const skipped: OutboxSkip[] = []

  for (const file of input.files) {
    if (processed.has(file.fileId)) {
      skipped.push({ fileId: file.fileId, reason: 'already_processed' })
      continue
    }
    if (TEMPLATE_NAME_PATTERN.test(file.name)) {
      skipped.push({ fileId: file.fileId, reason: 'template_file' })
      continue
    }
    if (!accepted.has(file.mimeType)) {
      skipped.push({ fileId: file.fileId, reason: 'unsupported_type' })
      continue
    }
    fetch.push(file)
  }

  // 오래된 핸드오프가 먼저 착지해야 lifecycle 순서가 Drive 의 시간 순서와 어긋나지 않는다.
  // 같은 시각이면 fileId 로 갈라 배치를 재현 가능하게 둔다.
  fetch.sort((a, b) =>
    a.modifiedTime === b.modifiedTime
      ? a.fileId.localeCompare(b.fileId)
      : a.modifiedTime.localeCompare(b.modifiedTime))

  return { fetch, skipped }
}

/**
 * Stage 2 — classify what was actually read.
 *
 * One malformed record never aborts the batch: the Drive contract has three lanes writing into
 * their own outboxes, and letting one bad file stop the others would make a single sender able
 * to stall the whole household.
 */
export function ingestDriveOutboxBatch(input: {
  entries: readonly OutboxBatchEntry[]
  processedEventIds?: readonly string[]
  context: { capturedBy: string; capturedAt: string }
}): OutboxBatchResult {
  const seenEventIds = new Set(input.processedEventIds ?? [])
  const entries: OutboxEntryResult[] = []
  const processedFileIds: string[] = []
  const processedEventIds: string[] = []

  for (const entry of input.entries) {
    processedFileIds.push(entry.file.fileId)

    const parsed = parseDorandoranHandoff(entry.record, input.context)
    if (!parsed.ok) {
      // Unit 31 의 어휘를 그대로 옮긴다 — 이 층은 새 거부 사유를 만들지 않는다.
      entries.push(
        parsed.field === undefined
          ? { fileId: entry.file.fileId, outcome: 'rejected', code: parsed.code }
          : { fileId: entry.file.fileId, outcome: 'rejected', code: parsed.code, field: parsed.field },
      )
      continue
    }

    const eventId = parsed.intake.capture.id
    if (seenEventIds.has(eventId)) {
      entries.push({ fileId: entry.file.fileId, outcome: 'duplicate', eventId })
      continue
    }

    seenEventIds.add(eventId)
    processedEventIds.push(eventId)
    entries.push({ fileId: entry.file.fileId, outcome: 'accepted', eventId, intake: parsed.intake })
  }

  return { entries, processedFileIds, processedEventIds }
}
