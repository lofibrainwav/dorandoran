import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeDriveOutboxFile,
  planDriveOutboxIntake,
  ingestDriveOutboxBatch,
} from '../../lib/family-os/drive-outbox-intake.ts'

const CONTEXT = { capturedBy: 'dorandoran-outbox', capturedAt: '2026-09-09T08:00:00.000Z' }

function file(overrides = {}) {
  return {
    fileId: 'file-1',
    name: '20260909-0415-jay-note',
    modifiedTime: '2026-09-09T04:15:00.000Z',
    mimeType: 'application/vnd.google-apps.document',
    ...overrides,
  }
}

function record(overrides = {}) {
  return {
    eventId: 'evt-1',
    occurredAt: '2026-09-08T10:00:00.000Z',
    person: 'jay',
    domain: 'career',
    kind: 'capture',
    privacyScope: 'personal',
    status: 'candidate',
    sourceSystem: 'chatgpt',
    sourceRefs: [],
    evidenceRefs: [],
    statedText: 'stated as-is',
    unknowns: [],
    candidateSuggested: false,
    requestedAction: 'none',
    ...overrides,
  }
}

// ---- normalizeDriveOutboxFile ----

test('a Drive v3 payload normalizes into the provider-neutral shape', () => {
  const normalized = normalizeDriveOutboxFile({
    id: 'drive-file-1',
    name: 'handoff.md',
    mimeType: 'text/markdown',
    modifiedTime: '2026-09-09T04:15:00.000Z',
  })
  assert.deepEqual(normalized, {
    fileId: 'drive-file-1',
    name: 'handoff.md',
    modifiedTime: '2026-09-09T04:15:00.000Z',
    mimeType: 'text/markdown',
  })
})

test('an unobservable Drive payload throws instead of being dropped', () => {
  const invalid = [
    { id: '', name: 'n', mimeType: 'text/plain', modifiedTime: '2026-09-09T04:15:00.000Z' },
    { id: '  ', name: 'n', mimeType: 'text/plain', modifiedTime: '2026-09-09T04:15:00.000Z' },
    { id: 'f', name: 'n', mimeType: 'text/plain', modifiedTime: 'yesterday' },
    { id: 'f', name: 'n', mimeType: 'text/plain' },
    { id: 'f', name: '', mimeType: 'text/plain', modifiedTime: '2026-09-09T04:15:00.000Z' },
  ]
  for (const payload of invalid) {
    assert.throws(
      () => normalizeDriveOutboxFile(payload),
      /INVALID_DRIVE_OUTBOX_FILE/,
      `expected throw for ${JSON.stringify(payload)}`,
    )
  }
})

// ---- Stage 1: planDriveOutboxIntake ----

test('an unseen supported file is planned for fetch', () => {
  const plan = planDriveOutboxIntake({ files: [file()] })
  assert.deepEqual(plan.fetch.map((entry) => entry.fileId), ['file-1'])
  assert.deepEqual(plan.skipped, [])
})

test('an already-processed file is skipped before any read is paid for', () => {
  const plan = planDriveOutboxIntake({ files: [file()], processedFileIds: ['file-1'] })
  assert.deepEqual(plan.fetch, [])
  assert.deepEqual(plan.skipped, [{ fileId: 'file-1', reason: 'already_processed' }])
})

test('an unsupported mime type is skipped', () => {
  const plan = planDriveOutboxIntake({ files: [file({ mimeType: 'image/png' })] })
  assert.deepEqual(plan.fetch, [])
  assert.deepEqual(plan.skipped, [{ fileId: 'file-1', reason: 'unsupported_type' }])
})

test('the fetch list is deterministic — oldest modifiedTime first, fileId breaks ties', () => {
  const plan = planDriveOutboxIntake({
    files: [
      file({ fileId: 'c', modifiedTime: '2026-09-09T06:00:00.000Z' }),
      file({ fileId: 'b', modifiedTime: '2026-09-09T04:00:00.000Z' }),
      file({ fileId: 'a', modifiedTime: '2026-09-09T04:00:00.000Z' }),
    ],
  })
  assert.deepEqual(plan.fetch.map((entry) => entry.fileId), ['a', 'b', 'c'])
})

test('a missing processed set means re-ingest, never skip-everything', () => {
  const plan = planDriveOutboxIntake({ files: [file()], processedFileIds: undefined })
  assert.deepEqual(plan.fetch.map((entry) => entry.fileId), ['file-1'])
})

// ---- Stage 2: ingestDriveOutboxBatch ----

test('a valid record is accepted and carries the Unit 31 intake', () => {
  const result = ingestDriveOutboxBatch({
    entries: [{ file: file(), record: record() }],
    context: CONTEXT,
  })
  assert.equal(result.entries.length, 1)
  const [entry] = result.entries
  assert.equal(entry.outcome, 'accepted')
  assert.equal(entry.eventId, 'evt-1')
  assert.equal(entry.intake.capture.statedText, 'stated as-is')
  assert.deepEqual(result.processedFileIds, ['file-1'])
  assert.deepEqual(result.processedEventIds, ['evt-1'])
})

test('an eventId processed in an earlier batch is a duplicate, not a re-ingest', () => {
  const result = ingestDriveOutboxBatch({
    entries: [{ file: file(), record: record() }],
    processedEventIds: ['evt-1'],
    context: CONTEXT,
  })
  assert.equal(result.entries[0].outcome, 'duplicate')
  assert.deepEqual(result.processedEventIds, [])
})

test('a record Unit 31 rejects keeps its reject code and field verbatim', () => {
  const result = ingestDriveOutboxBatch({
    entries: [{ file: file(), record: record({ requestedAction: 'accept_candidate' }) }],
    context: CONTEXT,
  })
  const [entry] = result.entries
  assert.equal(entry.outcome, 'rejected')
  assert.equal(entry.code, 'ACCEPT_BY_AI_FORBIDDEN')
  assert.equal(entry.field, 'sourceSystem')
})

test('one malformed record never aborts the batch — other lanes keep flowing', () => {
  const result = ingestDriveOutboxBatch({
    entries: [
      { file: file({ fileId: 'f1' }), record: 'not-an-object' },
      { file: file({ fileId: 'f2' }), record: record({ eventId: 'evt-2' }) },
    ],
    context: CONTEXT,
  })
  assert.equal(result.entries[0].outcome, 'rejected')
  assert.equal(result.entries[0].code, 'FIELD_MISSING')
  assert.equal(result.entries[1].outcome, 'accepted')
  assert.deepEqual(result.processedEventIds, ['evt-2'])
})

test('the same eventId twice in one batch accepts the first and marks the rest duplicate', () => {
  const result = ingestDriveOutboxBatch({
    entries: [
      { file: file({ fileId: 'f1' }), record: record() },
      { file: file({ fileId: 'f2' }), record: record({ statedText: 'second copy' }) },
    ],
    context: CONTEXT,
  })
  assert.equal(result.entries[0].outcome, 'accepted')
  assert.equal(result.entries[1].outcome, 'duplicate')
  assert.deepEqual(result.processedEventIds, ['evt-1'])
})

test('a rejected entry still marks its file processed so it is not re-read forever', () => {
  const result = ingestDriveOutboxBatch({
    entries: [{ file: file(), record: 'not-an-object' }],
    context: CONTEXT,
  })
  assert.deepEqual(result.processedFileIds, ['file-1'])
})
