import test from 'node:test'
import assert from 'node:assert/strict'
import { applePhotoBatchDigest, createPostgresApplePhotoStreamStore } from '../../lib/server/apple-photo-stream-store.ts'

function batch(overrides = {}) {
  return {
    protocolVersion: 1,
    deviceId: 'iphone-julie-01',
    libraryScope: 'family-shared',
    cursor: 'cursor-001',
    sentAt: '2026-09-10T19:00:00.000Z',
    events: [{ operation: 'upsert', photo: { cloudId: 'asset-1', capturedAt: '2026-09-10T18:00:00.000Z', modifiedAt: '2026-09-10T18:01:00.000Z', mediaType: 'image' } }],
    ...overrides,
  }
}

function fakeTransaction(script) {
  const calls = []
  let index = 0
  return {
    calls,
    transaction: async (run) => run(async (text, params = []) => {
      calls.push({ text, params })
      const response = script[index++]
      if (!response) throw new Error(`missing scripted response ${index}`)
      return { rows: response.rows ?? [], rowCount: response.rowCount ?? 0 }
    }),
  }
}

test('ingest writes receipt, metadata, and cursor in one transaction', async () => {
  const fake = fakeTransaction([{ rowCount: 1 }, { rowCount: 1 }, { rowCount: 1 }])
  const result = await createPostgresApplePhotoStreamStore({ query: async () => ({ rows: [], rowCount: 0 }), transaction: fake.transaction }).ingest(batch())
  assert.equal(result.status, 'accepted')
  assert.equal(result.eventCount, 1)
  assert.equal(fake.calls.length, 3)
  assert.match(fake.calls[0].text, /apple_photo_event_receipt/)
  assert.match(fake.calls[1].text, /apple_photo_metadata/)
  assert.match(fake.calls[2].text, /apple_photo_cursor/)
})

test('duplicate receipt is idempotent and skips event/cursor writes', async () => {
  const fake = fakeTransaction([{ rowCount: 0 }])
  const result = await createPostgresApplePhotoStreamStore({ query: async () => ({ rows: [], rowCount: 0 }), transaction: fake.transaction }).ingest(batch())
  assert.equal(result.status, 'duplicate')
  assert.equal(fake.calls.length, 1)
})

test('delete delta updates the existing photo without deleting the evidence row', async () => {
  const fake = fakeTransaction([{ rowCount: 1 }, { rowCount: 1 }, { rowCount: 1 }])
  await createPostgresApplePhotoStreamStore({ query: async () => ({ rows: [], rowCount: 0 }), transaction: fake.transaction }).ingest(batch({ events: [{ operation: 'delete', cloudId: 'asset-1' }] }))
  assert.match(fake.calls[1].text, /SET deleted_at/)
  assert.match(fake.calls[1].text, /UPDATE apple_photo_metadata/)
})

test('digest changes when a metadata event changes', () => {
  assert.notEqual(applePhotoBatchDigest(batch()), applePhotoBatchDigest(batch({ cursor: 'cursor-002' })))
})
