import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createMemoryDriveOutboxCursorStore,
  createPostgresDriveOutboxCursorStore,
} from '../../lib/server/drive-outbox-cursor-store.ts'

const NOW = '2026-09-09T12:00:00.000Z'

// ---- memory store: the contract ----

test('an untouched lane starts empty', async () => {
  const store = createMemoryDriveOutboxCursorStore()
  assert.deepEqual(await store.loadCursor('10_JAY'), { fileIds: [], eventIds: [] })
})

test('advancing remembers files and events together', async () => {
  const store = createMemoryDriveOutboxCursorStore()
  await store.advanceCursor({ lane: '10_JAY', fileIds: ['f2', 'f1'], eventIds: ['e1'], now: NOW })
  assert.deepEqual(await store.loadCursor('10_JAY'), { fileIds: ['f1', 'f2'], eventIds: ['e1'] })
})

test('re-applying the same deltas is a no-op, not an error', async () => {
  const store = createMemoryDriveOutboxCursorStore()
  await store.advanceCursor({ lane: '10_JAY', fileIds: ['f1'], eventIds: ['e1'], now: NOW })
  await store.advanceCursor({ lane: '10_JAY', fileIds: ['f1'], eventIds: ['e1'], now: NOW })
  assert.deepEqual(await store.loadCursor('10_JAY'), { fileIds: ['f1'], eventIds: ['e1'] })
})

test('lanes never share a dedup set', async () => {
  const store = createMemoryDriveOutboxCursorStore()
  await store.advanceCursor({ lane: '10_JAY', fileIds: ['f1'], eventIds: ['e1'], now: NOW })
  await store.advanceCursor({ lane: '00_DORANDORAN_FAMILY', fileIds: ['f9'], eventIds: [], now: NOW })
  assert.deepEqual(await store.loadCursor('10_JAY'), { fileIds: ['f1'], eventIds: ['e1'] })
  assert.deepEqual(await store.loadCursor('00_DORANDORAN_FAMILY'), { fileIds: ['f9'], eventIds: [] })
})

test('a blank lane fails closed rather than merging households', async () => {
  const store = createMemoryDriveOutboxCursorStore()
  for (const lane of ['', '   ']) {
    await assert.rejects(() => store.loadCursor(lane), /DRIVE_OUTBOX_LANE_REQUIRED/)
    await assert.rejects(
      () => store.advanceCursor({ lane, fileIds: ['f1'], eventIds: [], now: NOW }),
      /DRIVE_OUTBOX_LANE_REQUIRED/,
    )
  }
})

test('loaded ids are sorted so a plan is reproducible regardless of write order', async () => {
  const store = createMemoryDriveOutboxCursorStore()
  await store.advanceCursor({ lane: '10_JAY', fileIds: ['fc'], eventIds: ['e2'], now: NOW })
  await store.advanceCursor({ lane: '10_JAY', fileIds: ['fa', 'fb'], eventIds: ['e1'], now: NOW })
  assert.deepEqual(await store.loadCursor('10_JAY'), { fileIds: ['fa', 'fb', 'fc'], eventIds: ['e1', 'e2'] })
})

// ---- postgres store: the SQL it actually issues ----

function recordingQuery() {
  const calls = []
  const query = async (text, params) => {
    calls.push({ text, params })
    return { rows: [], rowCount: 0 }
  }
  return { calls, query }
}

test('an empty advance issues no write at all', async () => {
  const { calls, query } = recordingQuery()
  const store = createPostgresDriveOutboxCursorStore({ query })
  await store.advanceCursor({ lane: '10_JAY', fileIds: [], eventIds: [], now: NOW })
  assert.deepEqual(calls, [])
})

test('files and events advance in one statement so the cursor is never half-advanced', async () => {
  const { calls, query } = recordingQuery()
  const store = createPostgresDriveOutboxCursorStore({ query })
  await store.advanceCursor({ lane: '10_JAY', fileIds: ['f1'], eventIds: ['e1'], now: NOW })
  assert.equal(calls.length, 1)
  assert.match(calls[0].text, /INSERT INTO drive_outbox_cursor/)
  assert.match(calls[0].text, /ON CONFLICT DO NOTHING/)
  assert.deepEqual(calls[0].params, ['10_JAY', 'file', 'f1', NOW, '10_JAY', 'event', 'e1', NOW])
})

test('postgres load splits the two kinds and sorts them', async () => {
  const query = async () => ({
    rows: [
      { kind: 'file', value: 'f2' },
      { kind: 'event', value: 'e1' },
      { kind: 'file', value: 'f1' },
    ],
    rowCount: 3,
  })
  const store = createPostgresDriveOutboxCursorStore({ query })
  assert.deepEqual(await store.loadCursor('10_JAY'), { fileIds: ['f1', 'f2'], eventIds: ['e1'] })
})

test('postgres load is lane-scoped', async () => {
  const { calls, query } = recordingQuery()
  const store = createPostgresDriveOutboxCursorStore({ query })
  await store.loadCursor('20_SHARED_PROJECTS')
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].params, ['20_SHARED_PROJECTS'])
})
