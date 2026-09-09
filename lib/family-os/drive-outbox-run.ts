import {
  ingestDriveOutboxBatch,
  normalizeDriveOutboxFile,
  planDriveOutboxIntake,
  type OutboxBatchEntry,
  type OutboxEntryResult,
  type OutboxFile,
  type OutboxSkip,
} from './drive-outbox-intake.ts'
import { parseOutboxRecordText } from './drive-outbox-record.ts'

/**
 * Unit 37 — one Drive Outbox run. Joins Unit 34 (plan/classify), Unit 36 (text → record) and
 * Unit 31 (record → CaptureEvent) into a single pass.
 *
 * I/O arrives as injected ports. The real OAuth round trip cannot be verified from a build seat,
 * so the orchestration is testable here and only the transport implementation is left to a
 * session that can authenticate. Nothing here persists anything or creates a Task.
 */

export interface DriveOutboxPorts {
  /** Drive v3 `files.list` payloads, unnormalized. */
  listFiles(): Promise<readonly unknown[]>
  readFile(fileId: string): Promise<{ text: string; mimeType: string }>
}

export type DriveOutboxUnreadableReason = 'list_payload' | 'read_failed' | 'parse_failed'

export interface DriveOutboxUnreadable {
  fileId: string
  reason: DriveOutboxUnreadableReason
}

export interface DriveOutboxRunResult {
  entries: OutboxEntryResult[]
  skipped: OutboxSkip[]
  unreadable: DriveOutboxUnreadable[]
  processedFileIds: string[]
  processedEventIds: string[]
}

/** 식별조차 못 한 payload 의 이름. 없는 id 를 지어내지 않고 관측 불가임을 그대로 말한다. */
const UNIDENTIFIED_FILE_ID = '(unidentified)'

function payloadFileId(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'id' in payload) {
    const id = (payload as { id?: unknown }).id
    if (typeof id === 'string' && id.trim() !== '') return id.trim()
  }
  return UNIDENTIFIED_FILE_ID
}

export async function runDriveOutboxIntake(input: {
  ports: DriveOutboxPorts
  processedFileIds?: readonly string[]
  processedEventIds?: readonly string[]
  context: { capturedBy: string; capturedAt: string }
  mimeTypes?: readonly string[]
}): Promise<DriveOutboxRunResult> {
  const unreadable: DriveOutboxUnreadable[] = []

  let payloads: readonly unknown[]
  try {
    payloads = await input.ports.listFiles()
  } catch {
    // 목록을 못 읽으면 부분적일 것이 없다. 관측 실패를 빈 폴더로 축약하면 조용히 아무것도 안 하게 된다.
    throw new Error('DRIVE_OUTBOX_LIST_FAILED')
  }

  const files: OutboxFile[] = []
  for (const payload of payloads) {
    try {
      files.push(normalizeDriveOutboxFile(payload as Parameters<typeof normalizeDriveOutboxFile>[0]))
    } catch {
      unreadable.push({ fileId: payloadFileId(payload), reason: 'list_payload' })
    }
  }

  const plan = planDriveOutboxIntake({
    files,
    processedFileIds: input.processedFileIds,
    ...(input.mimeTypes === undefined ? {} : { mimeTypes: input.mimeTypes }),
  })

  const batch: OutboxBatchEntry[] = []
  const unreadableFileIds: string[] = []
  for (const file of plan.fetch) {
    let body: { text: string; mimeType: string }
    try {
      body = await input.ports.readFile(file.fileId)
    } catch {
      // 파일 하나의 실패가 실행을 멈추지 않는다 — 세 lane 이 각자 outbox 에 쓰는데
      // 못 읽는 파일 하나가 가정 전체를 세우면 안 된다 (Unit 34 의 배치 규칙과 같은 자세).
      unreadable.push({ fileId: file.fileId, reason: 'read_failed' })
      unreadableFileIds.push(file.fileId)
      continue
    }
    try {
      batch.push({ file, record: parseOutboxRecordText(body.text, { mimeType: body.mimeType }) })
    } catch {
      unreadable.push({ fileId: file.fileId, reason: 'parse_failed' })
      unreadableFileIds.push(file.fileId)
    }
  }

  const ingested = ingestDriveOutboxBatch({
    entries: batch,
    ...(input.processedEventIds === undefined ? {} : { processedEventIds: input.processedEventIds }),
    context: input.context,
  })

  return {
    entries: ingested.entries,
    skipped: plan.skipped,
    unreadable,
    // 못 읽은 파일도 처리됨으로 남긴다. 아니면 다음 실행이 같은 깨진 파일을 영원히 다시 읽는다.
    // 대가는 분명하다: 일시적 실패는 재시도되지 않는다. 재시도는 커서 주인의 몫이고 아직 없다.
    processedFileIds: [...ingested.processedFileIds, ...unreadableFileIds],
    processedEventIds: ingested.processedEventIds,
  }
}
