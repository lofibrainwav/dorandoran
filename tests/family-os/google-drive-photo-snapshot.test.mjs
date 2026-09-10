import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadGoogleDrivePhotoSnapshot,
  parseGoogleDrivePhotoSnapshot,
} from '../../lib/server/google-drive-photo-snapshot.ts'

const env = {
  APPLE_PHOTOS_DRIVE_FILE_ID: 'photo-snapshot-file',
  DRIVE_OUTBOX_CLIENT_ID: 'client-id',
  DRIVE_OUTBOX_CLIENT_SECRET: 'client-secret',
  DRIVE_OUTBOX_REFRESH_TOKEN: 'refresh-token',
}

function payload(overrides = {}) {
  return JSON.stringify({
    version: 1,
    generatedAt: '2026-09-10T12:00:00.000Z',
    result: {
      source: 'apple-photos-album',
      sourceHealth: 'green',
      selectedCount: 0,
      sourceState: 'ready',
      experience: { clusters: [], stories: [], unlocatedMemoryCount: 0, ungroupedMemoryCount: 0 },
      ...overrides,
    },
  })
}

test('missing Drive file configuration is distinct from an empty album', async () => {
  assert.deepEqual(await loadGoogleDrivePhotoSnapshot({ env: {}, now: new Date('2026-09-10T13:00:00Z'), maxAgeMs: 86_400_000 }), {
    status: 'missing', generatedAt: null, result: null,
  })
})

test('exact Drive file payload is parsed as a fresh empty Photos snapshot', () => {
  const result = parseGoogleDrivePhotoSnapshot({
    raw: payload(), now: new Date('2026-09-10T13:00:00Z'), maxAgeMs: 86_400_000,
  })
  assert.equal(result.status, 'fresh')
  assert.equal(result.result?.selectedCount, 0)
  assert.equal(result.result?.sourceState, 'ready')
})

test('Shortcut raw photo metadata is projected into privacy-safe journey clusters', () => {
  const result = parseGoogleDrivePhotoSnapshot({
    raw: JSON.stringify({
      version: 1,
      generatedAt: '2026-09-10T12:00:00.000Z',
      photos: [{ id: 'photo-1', capturedAt: '2026-09-09T12:00:00Z', latitude: 37.5665, longitude: 126.9780 }],
    }),
    now: new Date('2026-09-10T13:00:00Z'), maxAgeMs: 86_400_000,
  })
  assert.equal(result.status, 'fresh')
  assert.equal(result.result?.selectedCount, 1)
  assert.equal(result.result?.experience.clusters.length, 1)
  assert.deepEqual(result.result?.experience.clusters[0].coordinates, { latitude: 37.5665, longitude: 126.978 })
})

test('Drive reader fetches only the configured file id', async () => {
  const ids = []
  const result = await loadGoogleDrivePhotoSnapshot({
    env, now: new Date('2026-09-10T13:00:00Z'), maxAgeMs: 86_400_000,
    fetcher: async (fileId) => { ids.push(fileId); return payload() },
  })
  assert.deepEqual(ids, ['photo-snapshot-file'])
  assert.equal(result.status, 'fresh')
})

test('stale, malformed, and oversized snapshots fail closed', () => {
  const now = new Date('2026-09-10T13:00:00Z')
  assert.equal(parseGoogleDrivePhotoSnapshot({ raw: payload(), now: new Date('2026-09-12T13:00:00Z'), maxAgeMs: 86_400_000 }).status, 'stale')
  assert.equal(parseGoogleDrivePhotoSnapshot({ raw: '{bad', now, maxAgeMs: 86_400_000 }).status, 'invalid')
  assert.equal(parseGoogleDrivePhotoSnapshot({ raw: 'x'.repeat(512 * 1024 + 1), now, maxAgeMs: 86_400_000 }).status, 'invalid')
})

test('partial Drive credentials do not call the provider', async () => {
  let called = false
  const result = await loadGoogleDrivePhotoSnapshot({
    env: { APPLE_PHOTOS_DRIVE_FILE_ID: 'file', DRIVE_OUTBOX_CLIENT_ID: 'client' },
    now: new Date('2026-09-10T13:00:00Z'), maxAgeMs: 86_400_000,
    fetcher: async () => { called = true; return payload() },
  })
  assert.equal(result.status, 'invalid')
  assert.equal(called, false)
})
