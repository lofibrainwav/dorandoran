import { runDriveOutboxIntake, type DriveOutboxPorts, type DriveOutboxRunResult } from '../family-os/drive-outbox-run.ts'
import type { OutboxEntryResult } from '../family-os/drive-outbox-intake.ts'
import type { DriveOutboxCursorStore } from './drive-outbox-cursor-store.ts'

/**
 * Unit 39 — one complete Drive Outbox cycle: load the cursor, run, advance the cursor.
 *
 * Unit 37 runs but remembers nothing; Unit 38 remembers but never runs. Neither knows the other
 * exists. This is the join. Ports stay injected — no Drive API, no OAuth, no scheduler.
 */

export interface DriveOutboxSessionResult extends DriveOutboxRunResult {
  lane: string
  /** step 3 이 실제로 썼는지. 호출자가 "할 일 없음" 과 "하고 기억함" 을 구분할 수 있어야 한다. */
  cursorAdvanced: boolean
}

export async function runDriveOutboxSession(input: {
  lane: string
  store: DriveOutboxCursorStore
  ports: DriveOutboxPorts
  context: { capturedBy: string; capturedAt: string }
  now: string
  mimeTypes?: readonly string[]
  onAccepted?: (entry: Extract<OutboxEntryResult, { outcome: 'accepted' }>) => Promise<void>
}): Promise<DriveOutboxSessionResult> {
  // 커서를 모르는 것은 커서가 빈 것과 다르다. 모른 채로 돌면 outbox 전체를 다시 ingest 하고,
  // 그때는 eventId dedup 하나가 중복된 가정 기록을 막는 유일한 방벽이 된다 — 그대로 두지 않는다.
  const cursor = await input.store.loadCursor(input.lane)

  const run = await runDriveOutboxIntake({
    ports: input.ports,
    processedFileIds: cursor.fileIds,
    processedEventIds: cursor.eventIds,
    context: input.context,
    ...(input.mimeTypes === undefined ? {} : { mimeTypes: input.mimeTypes }),
  })

  // 전진할 것이 없으면 아예 부르지 않는다. Unit 38 도 빈 delta 를 거르지만, 하류의 no-op 에
  // 기대어 의도를 표현하면 그 의도가 코드에서 사라진다.
  const hasDelta = run.processedFileIds.length > 0 || run.processedEventIds.length > 0
  if (!hasDelta) return { ...run, lane: input.lane, cursorAdvanced: false }

  if (input.onAccepted) {
    for (const entry of run.entries) {
      if (entry.outcome === 'accepted') await input.onAccepted(entry)
    }
  }

  // 여기서 던지면 세션이 실패한다 — 일은 벌어졌는데 기억되지 않은 상태다. 삼키지 않는 이유:
  // 남는 실패 모드가 안전한 쪽이기 때문이다. 다음 실행이 같은 파일을 다시 읽고 같은 레코드를
  // 다시 넣지만 Unit 34 의 eventId dedup 이 그것을 duplicate 로 만든다. 반대로 성공했다고
  // 보고하면서 커서가 조용히 안 움직이면, 호출자는 내구성을 믿는데 실제로는 없다.
  await input.store.advanceCursor({
    lane: input.lane,
    fileIds: run.processedFileIds,
    eventIds: run.processedEventIds,
    now: input.now,
  })

  return { ...run, lane: input.lane, cursorAdvanced: true }
}
