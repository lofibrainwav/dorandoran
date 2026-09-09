import test from 'node:test'
import assert from 'node:assert/strict'

import { runDriveOutboxSession } from '../../lib/server/drive-outbox-session.ts'
import { createMemoryDriveOutboxCursorStore } from '../../lib/server/drive-outbox-cursor-store.ts'

const CONTEXT = { capturedBy: 'dorandoran-outbox', capturedAt: '2026-09-09T08:00:00.000Z' }
const NOW = '2026-09-09T12:00:00.000Z'
const LANE = '10_JAY'

function payload(overrides = {}) {
  return {
    id: 'file-1',
    name: 'handoff.md',
    mimeType: 'text/markdown',
    modifiedTime: '2026-09-09T04:15:00.000Z',
    ...overrides,
  }
}

function recordText(overrides = {}) {
  const fields = {
    eventId: 'evt-1',
    occurredAt: '2026-09-08T10:00:00.000Z',
    person: 'jay',
    domain: 'career',
    kind: 'capture',
    privacyScope: 'personal',
    status: 'candidate',
    sourceSystem: 'claude',
    statedText: 'stated as-is',
    candidateSuggested: 'false',
    requestedAction: 'none',
    ...overrides,
  }
  return Object.entries(fields).map(([key, value]) => `${key}: ${value}`).join('\n')
}

function ports({ files = [payload()], listThrows = false } = {}) {
  return {
    listFiles: async () => {
      if (listThrows) throw new Error('network down')
      return files
    },
    readFile: async () => ({ text: recordText(), mimeType: 'text/markdown' }),
  }
}

test('one cycle ingests and remembers', async () => {
  const store = createMemoryDriveOutboxCursorStore()
  const result = await runDriveOutboxSession({ lane: LANE, store, ports: ports(), context: CONTEXT, now: NOW })
  assert.equal(result.lane, LANE)
  assert.equal(result.cursorAdvanced, true)
  assert.equal(result.entries[0].outcome, 'accepted')
  assert.deepEqual(await store.loadCursor(LANE), { fileIds: ['file-1'], eventIds: ['evt-1'] })
})

test('a second cycle over the same folder does nothing and writes nothing', async () => {
  const store = createMemoryDriveOutboxCursorStore()
  await runDriveOutboxSession({ lane: LANE, store, ports: ports(), context: CONTEXT, now: NOW })
  const second = await runDriveOutboxSession({ lane: LANE, store, ports: ports(), context: CONTEXT, now: NOW })
  assert.equal(second.cursorAdvanced, false)
  assert.deepEqual(second.entries, [])
  assert.deepEqual(second.skipped, [{ fileId: 'file-1', reason: 'already_processed' }])
})

test('an empty outbox is a clean cycle that writes nothing', async () => {
  const store = createMemoryDriveOutboxCursorStore()
  const result = await runDriveOutboxSession({ lane: LANE, store, ports: ports({ files: [] }), context: CONTEXT, now: NOW })
  assert.equal(result.cursorAdvanced, false)
  assert.deepEqual(await store.loadCursor(LANE), { fileIds: [], eventIds: [] })
})

test('not knowing the cursor is not an empty cursor — a load failure rejects before any read', async () => {
  let reads = 0
  const store = {
    loadCursor: async () => { throw new Error('db down') },
    advanceCursor: async () => {},
  }
  const base = ports()
  await assert.rejects(
    () => runDriveOutboxSession({
      lane: LANE,
      store,
      ports: { listFiles: base.listFiles, readFile: async (id) => { reads += 1; return base.readFile(id) } },
      context: CONTEXT,
      now: NOW,
    }),
    /db down/,
  )
  assert.equal(reads, 0)
})

test('a listing failure leaves the cursor untouched', async () => {
  const store = createMemoryDriveOutboxCursorStore()
  await assert.rejects(
    () => runDriveOutboxSession({ lane: LANE, store, ports: ports({ listThrows: true }), context: CONTEXT, now: NOW }),
    /DRIVE_OUTBOX_LIST_FAILED/,
  )
  assert.deepEqual(await store.loadCursor(LANE), { fileIds: [], eventIds: [] })
})

test('an advance failure is loud, because the safe failure is re-ingest, not silent loss', async () => {
  const memory = createMemoryDriveOutboxCursorStore()
  const store = {
    loadCursor: memory.loadCursor,
    advanceCursor: async () => { throw new Error('write conflict') },
  }
  await assert.rejects(
    () => runDriveOutboxSession({ lane: LANE, store, ports: ports(), context: CONTEXT, now: NOW }),
    /write conflict/,
  )
})

test('the loaded cursor is what suppresses a repeated eventId, even from a new file', async () => {
  const store = createMemoryDriveOutboxCursorStore()
  await store.advanceCursor({ lane: LANE, fileIds: [], eventIds: ['evt-1'], now: NOW })
  const result = await runDriveOutboxSession({
    lane: LANE, store, ports: ports({ files: [payload({ id: 'different-file' })] }), context: CONTEXT, now: NOW,
  })
  assert.equal(result.entries[0].outcome, 'duplicate')
  // 파일은 처리됨으로 남지만 eventId 는 새로 추가되지 않는다.
  assert.deepEqual(await store.loadCursor(LANE), { fileIds: ['different-file'], eventIds: ['evt-1'] })
})

test('lanes do not see each other', async () => {
  const store = createMemoryDriveOutboxCursorStore()
  await runDriveOutboxSession({ lane: LANE, store, ports: ports(), context: CONTEXT, now: NOW })
  const other = await runDriveOutboxSession({
    lane: '00_DORANDORAN_FAMILY', store, ports: ports(), context: CONTEXT, now: NOW,
  })
  assert.equal(other.entries[0].outcome, 'accepted')
  assert.equal(other.cursorAdvanced, true)
})
