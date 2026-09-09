/**
 * Unit 38 — Drive Outbox cursor store. Unit 37 returns processed ids as deltas and stores nothing,
 * naming the gap in its own spec: "retry belongs to whoever owns the cursor, and that owner does
 * not exist yet." This is that owner.
 *
 * It does not decide whether something was processed — Units 34/37 already did. It only remembers.
 */

export interface DriveOutboxCursor {
  fileIds: string[]
  eventIds: string[]
}

export interface DriveOutboxCursorStore {
  loadCursor(lane: string): Promise<DriveOutboxCursor>
  advanceCursor(input: {
    lane: string
    fileIds: readonly string[]
    eventIds: readonly string[]
    now: string
  }): Promise<void>
}

export type DriveOutboxQueryResult = { rows: Record<string, unknown>[]; rowCount: number | null }
export type DriveOutboxQueryFn = (text: string, params?: unknown[]) => Promise<DriveOutboxQueryResult>

const CURSOR_KIND_FILE = 'file'
const CURSOR_KIND_EVENT = 'event'

/** lane 없는 커서는 세 가정의 dedup 집합을 하나로 합친다. 그건 조용한 데이터 오염이다. */
function requireLane(lane: string): string {
  if (typeof lane !== 'string' || lane.trim() === '') throw new Error('DRIVE_OUTBOX_LANE_REQUIRED')
  return lane.trim()
}

function normalizedIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map(String).filter((id) => id.trim() !== ''))].sort()
}

export function createMemoryDriveOutboxCursorStore(): DriveOutboxCursorStore {
  const files = new Map<string, Set<string>>()
  const events = new Map<string, Set<string>>()

  function laneSet(map: Map<string, Set<string>>, lane: string): Set<string> {
    const existing = map.get(lane)
    if (existing) return existing
    const created = new Set<string>()
    map.set(lane, created)
    return created
  }

  return {
    async loadCursor(lane: string): Promise<DriveOutboxCursor> {
      const key = requireLane(lane)
      return {
        fileIds: [...(files.get(key) ?? [])].sort(),
        eventIds: [...(events.get(key) ?? [])].sort(),
      }
    },
    async advanceCursor(input): Promise<void> {
      const key = requireLane(input.lane)
      // 집합이라 같은 delta 를 다시 적용해도 no-op 이다 — 성공 후 보고 중 실패한 실행은
      // 같은 delta 로 재시도되므로 멱등이 아니면 재시도가 에러가 된다.
      for (const id of normalizedIds(input.fileIds)) laneSet(files, key).add(id)
      for (const id of normalizedIds(input.eventIds)) laneSet(events, key).add(id)
    },
  }
}

export function createPostgresDriveOutboxCursorStore(input: {
  query: DriveOutboxQueryFn
}): DriveOutboxCursorStore {
  return {
    async loadCursor(lane: string): Promise<DriveOutboxCursor> {
      const key = requireLane(lane)
      const result = await input.query(
        'SELECT kind, value FROM drive_outbox_cursor WHERE lane = $1',
        [key],
      )
      const fileIds: string[] = []
      const eventIds: string[] = []
      for (const row of result.rows) {
        const value = typeof row.value === 'string' ? row.value : null
        if (value === null) continue
        if (row.kind === CURSOR_KIND_FILE) fileIds.push(value)
        else if (row.kind === CURSOR_KIND_EVENT) eventIds.push(value)
      }
      // 저장 순서와 무관하게 같은 계획이 나와야 한다.
      return { fileIds: fileIds.sort(), eventIds: eventIds.sort() }
    },

    async advanceCursor(cursorInput): Promise<void> {
      const key = requireLane(cursorInput.lane)
      const rows: Array<[string, string, string, string]> = [
        ...normalizedIds(cursorInput.fileIds).map(
          (id) => [key, CURSOR_KIND_FILE, id, cursorInput.now] as [string, string, string, string],
        ),
        ...normalizedIds(cursorInput.eventIds).map(
          (id) => [key, CURSOR_KIND_EVENT, id, cursorInput.now] as [string, string, string, string],
        ),
      ]
      // 빈 실행은 테이블을 건드리지 않는다.
      if (rows.length === 0) return

      const values = rows
        .map((_, index) => {
          const base = index * 4
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`
        })
        .join(', ')
      // 파일과 이벤트를 한 문장으로 함께 올린다. 나뉘면 절반만 전진한 커서가 생길 수 있고,
      // 그 상태가 바로 레코드를 조용히 잃는 유일한 상태다.
      await input.query(
        `INSERT INTO drive_outbox_cursor (lane, kind, value, processed_at) VALUES ${values} ON CONFLICT DO NOTHING`,
        rows.flat(),
      )
    },
  }
}
