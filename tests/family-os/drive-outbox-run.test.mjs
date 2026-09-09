import test from 'node:test'
import assert from 'node:assert/strict'

import { runDriveOutboxIntake } from '../../lib/family-os/drive-outbox-run.ts'

const CONTEXT = { capturedBy: 'dorandoran-outbox', capturedAt: '2026-09-09T08:00:00.000Z' }

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

function ports({ files = [payload()], bodies = {}, listThrows = false } = {}) {
  return {
    listFiles: async () => {
      if (listThrows) throw new Error('network down')
      return files
    },
    readFile: async (fileId) => {
      const body = bodies[fileId]
      if (body === undefined) return { text: recordText(), mimeType: 'text/markdown' }
      if (body instanceof Error) throw body
      return body
    },
  }
}

// ---- happy path ----

test('a single outbox file flows to an accepted CaptureEvent', async () => {
  const result = await runDriveOutboxIntake({ ports: ports(), context: CONTEXT })
  assert.equal(result.entries.length, 1)
  assert.equal(result.entries[0].outcome, 'accepted')
  assert.equal(result.entries[0].intake.capture.statedText, 'stated as-is')
  assert.deepEqual(result.processedFileIds, ['file-1'])
  assert.deepEqual(result.processedEventIds, ['evt-1'])
  assert.deepEqual(result.unreadable, [])
})

test('an already-processed file is skipped without being read', async () => {
  let reads = 0
  const base = ports()
  const result = await runDriveOutboxIntake({
    ports: { listFiles: base.listFiles, readFile: async (id) => { reads += 1; return base.readFile(id) } },
    processedFileIds: ['file-1'],
    context: CONTEXT,
  })
  assert.equal(reads, 0)
  assert.deepEqual(result.skipped, [{ fileId: 'file-1', reason: 'already_processed' }])
  assert.deepEqual(result.entries, [])
})

// ---- partial failure ----

test('an unidentifiable list payload is recorded, not thrown, and the rest still runs', async () => {
  const result = await runDriveOutboxIntake({
    ports: ports({ files: [{ id: '', name: 'broken', mimeType: 'text/plain', modifiedTime: 'yesterday' }, payload({ id: 'file-2' })] }),
    context: CONTEXT,
  })
  assert.equal(result.unreadable.length, 1)
  assert.equal(result.unreadable[0].reason, 'list_payload')
  assert.equal(result.entries.length, 1)
  assert.equal(result.entries[0].outcome, 'accepted')
})

test('a read failure never stops the run and marks the file processed', async () => {
  const result = await runDriveOutboxIntake({
    ports: ports({
      files: [payload({ id: 'f1', modifiedTime: '2026-09-09T01:00:00.000Z' }), payload({ id: 'f2', modifiedTime: '2026-09-09T02:00:00.000Z' })],
      bodies: { f1: new Error('403'), f2: { text: recordText({ eventId: 'evt-2' }), mimeType: 'text/markdown' } },
    }),
    context: CONTEXT,
  })
  assert.deepEqual(result.unreadable, [{ fileId: 'f1', reason: 'read_failed' }])
  assert.equal(result.entries.length, 1)
  assert.equal(result.entries[0].outcome, 'accepted')
  // 깨진 파일도 처리됨으로 남는다 — 아니면 다음 실행이 같은 파일을 영원히 다시 읽는다.
  assert.deepEqual(result.processedFileIds.sort(), ['f1', 'f2'])
})

test('a body with no known field is parse_failed, not an empty record', async () => {
  const result = await runDriveOutboxIntake({
    ports: ports({ bodies: { 'file-1': { text: 'RULES\n- nothing here\n', mimeType: 'text/plain' } } }),
    context: CONTEXT,
  })
  assert.deepEqual(result.unreadable, [{ fileId: 'file-1', reason: 'parse_failed' }])
  assert.deepEqual(result.entries, [])
  assert.deepEqual(result.processedFileIds, ['file-1'])
})

test('a record Unit 31 rejects is an entry, not an unreadable', async () => {
  const result = await runDriveOutboxIntake({
    ports: ports({ bodies: { 'file-1': { text: recordText({ requestedAction: 'accept_candidate' }), mimeType: 'text/markdown' } } }),
    context: CONTEXT,
  })
  assert.deepEqual(result.unreadable, [])
  assert.equal(result.entries[0].outcome, 'rejected')
  assert.equal(result.entries[0].code, 'ACCEPT_BY_AI_FORBIDDEN')
})

// ---- listing failure is different ----

test('a failed listing rejects — a failure to observe is not an empty folder', async () => {
  await assert.rejects(
    () => runDriveOutboxIntake({ ports: ports({ listThrows: true }), context: CONTEXT }),
    /DRIVE_OUTBOX_LIST_FAILED/,
  )
})

// ---- ordering and dedup carry through ----

test('files are read oldest-first and a repeated eventId becomes duplicate', async () => {
  const readOrder = []
  const base = ports({
    files: [payload({ id: 'newer', modifiedTime: '2026-09-09T09:00:00.000Z' }), payload({ id: 'older', modifiedTime: '2026-09-09T01:00:00.000Z' })],
  })
  const result = await runDriveOutboxIntake({
    ports: {
      listFiles: base.listFiles,
      readFile: async (id) => { readOrder.push(id); return { text: recordText(), mimeType: 'text/markdown' } },
    },
    context: CONTEXT,
  })
  assert.deepEqual(readOrder, ['older', 'newer'])
  assert.equal(result.entries[0].outcome, 'accepted')
  assert.equal(result.entries[1].outcome, 'duplicate')
  assert.deepEqual(result.processedEventIds, ['evt-1'])
})

test('an empty folder is a clean empty run, not an error', async () => {
  const result = await runDriveOutboxIntake({ ports: ports({ files: [] }), context: CONTEXT })
  assert.deepEqual(result, {
    entries: [], skipped: [], unreadable: [], processedFileIds: [], processedEventIds: [],
  })
})
