import test from 'node:test'
import assert from 'node:assert/strict'
import {
  APPLE_PHOTO_STREAM_MAX_EVENTS,
  canonicalApplePhotoMetadataBatch,
  parseApplePhotoMetadataBatch,
} from '../../lib/family-os/apple-photo-stream.ts'

const base = {
  protocolVersion: 1,
  deviceId: 'iphone-julie-01',
  libraryScope: 'family-shared',
  cursor: 'cursor-001',
  sentAt: '2026-09-10T12:00:00-07:00',
}

function upsert(overrides = {}) {
  return {
    operation: 'upsert',
    photo: {
      cloudId: 'iCloud/asset-001',
      capturedAt: '2026-09-09T19:00:00-07:00',
      modifiedAt: '2026-09-09T19:01:00-07:00',
      mediaType: 'image',
      latitude: 34.0522,
      longitude: -118.2437,
      ...overrides,
    },
  }
}

test('normalizes valid upsert metadata and timestamp values', () => {
  const batch = parseApplePhotoMetadataBatch({ ...base, events: [upsert()] })
  assert.ok(batch)
  assert.equal(batch.sentAt, '2026-09-10T19:00:00.000Z')
  assert.equal(batch.events[0].photo.capturedAt, '2026-09-10T02:00:00.000Z')
  assert.equal(batch.events[0].photo.latitude, 34.0522)
})

test('accepts metadata-only delete events', () => {
  const batch = parseApplePhotoMetadataBatch({
    ...base,
    events: [{ operation: 'delete', cloudId: 'iCloud/asset-002' }],
  })
  assert.deepEqual(batch?.events, [{ operation: 'delete', cloudId: 'iCloud/asset-002' }])
})

test('rejects raw photo payloads, unknown fields, and invalid coordinates', () => {
  assert.equal(parseApplePhotoMetadataBatch({ ...base, events: [upsert({ thumbnail: 'base64' })] }), null)
  assert.equal(parseApplePhotoMetadataBatch({ ...base, sourceBytes: 'raw-exif', events: [] }), null)
  assert.equal(parseApplePhotoMetadataBatch({ ...base, events: [upsert({ latitude: 91 })] }), null)
  assert.equal(parseApplePhotoMetadataBatch({ ...base, events: [upsert({ longitude: undefined })] }), null)
})

test('rejects malformed protocol, timestamps, operations, and oversize batches', () => {
  assert.equal(parseApplePhotoMetadataBatch({ ...base, protocolVersion: 2, events: [] }), null)
  assert.equal(parseApplePhotoMetadataBatch({ ...base, sentAt: 'not-a-date', events: [] }), null)
  assert.equal(parseApplePhotoMetadataBatch({ ...base, events: [{ operation: 'publish', cloudId: 'x' }] }), null)
  assert.equal(
    parseApplePhotoMetadataBatch({ ...base, events: Array.from({ length: APPLE_PHOTO_STREAM_MAX_EVENTS + 1 }, () => ({ operation: 'delete', cloudId: 'x' })) }),
    null,
  )
})

test('canonical representation is stable after normalization', () => {
  const first = parseApplePhotoMetadataBatch({ ...base, events: [upsert()] })
  const second = parseApplePhotoMetadataBatch({
    ...base,
    sentAt: '2026-09-10T19:00:00.000Z',
    events: [upsert({ capturedAt: '2026-09-10T02:00:00.000Z', modifiedAt: '2026-09-10T02:01:00.000Z' })],
  })
  assert.ok(first)
  assert.ok(second)
  assert.equal(canonicalApplePhotoMetadataBatch(first), canonicalApplePhotoMetadataBatch(second))
})
