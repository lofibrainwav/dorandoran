import test from 'node:test'
import assert from 'node:assert/strict'
import { loadApplePhotoMetadataProjection } from '../../lib/server/apple-photo-metadata-read.ts'

test('metadata projection is offline when database is not configured', async () => {
  const result = await loadApplePhotoMetadataProjection({ env: {}, now: new Date('2026-09-10T20:00:00.000Z'), maxAgeMs: 86_400_000 })
  assert.equal(result.status, 'offline')
  assert.equal(result.lastSyncedAt, null)
  assert.equal(result.selectedCount, 0)
})

test('projection never falls back to a fake live state on an unreachable database', async () => {
  const result = await loadApplePhotoMetadataProjection({
    env: { DATABASE_URL: 'postgres://user:pass@127.0.0.1:1/doran?sslmode=disable' },
    now: new Date('2026-09-10T20:00:00.000Z'),
    maxAgeMs: 86_400_000,
  })
  assert.equal(result.status, 'offline')
  assert.equal(result.selectedCount, 0)
})
