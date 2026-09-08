import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  loadPrivatePhotoSnapshot,
  refreshPrivatePhotoSnapshot,
} from '../../lib/server/private-photo-snapshot.ts'

const enabledEnv = { CHAD_PRIVATE_LOCAL_UI: '1', APPLE_PHOTOS_ALBUM_NAME: 'DoranDoran' }

function result(overrides = {}) {
  return {
    source: 'apple-photos-album', sourceHealth: 'green', selectedCount: 0, sourceState: 'ready',
    experience: { clusters: [], stories: [], unlocatedMemoryCount: 0, ungroupedMemoryCount: 0 },
    ...overrides,
  }
}

async function pathForTest() {
  const dir = await mkdtemp(join(tmpdir(), 'family-photo-snapshot-'))
  return join(dir, 'snapshot.json')
}

test('missing snapshot fails closed without touching the live Photos source', async () => {
  const snapshotPath = await pathForTest()
  const loaded = await loadPrivatePhotoSnapshot({
    env: { ...enabledEnv, CHAD_PRIVATE_PHOTO_SNAPSHOT_PATH: snapshotPath },
    now: new Date('2026-09-07T20:00:00Z'), maxAgeMs: 86400000,
  })
  assert.equal(loaded.status, 'missing')
  assert.equal(loaded.result, null)
})

test('explicit refresh writes and reloads a fresh privacy-safe snapshot', async () => {
  const snapshotPath = await pathForTest()
  const env = { ...enabledEnv, CHAD_PRIVATE_PHOTO_SNAPSHOT_PATH: snapshotPath }
  await refreshPrivatePhotoSnapshot({
    env, observedAt: '2026-09-07T20:00:00Z', maxGapMs: 3600000,
    loadSource: async () => ({ ...result({ selectedCount: 2 }), secret: 'must-strip', evidenceRef: 'e:private' }),
  })
  const raw = await readFile(snapshotPath, 'utf8')
  assert.equal(raw.includes('must-strip'), false)
  assert.equal(raw.includes('e:private'), false)
  const loaded = await loadPrivatePhotoSnapshot({ env, now: new Date('2026-09-07T20:05:00Z'), maxAgeMs: 86400000 })
  assert.equal(loaded.status, 'fresh')
  assert.equal(loaded.result.selectedCount, 2)
})

test('stale snapshot suppresses old photo result', async () => {
  const snapshotPath = await pathForTest()
  const env = { ...enabledEnv, CHAD_PRIVATE_PHOTO_SNAPSHOT_PATH: snapshotPath }
  await writeFile(snapshotPath, JSON.stringify({ version: 1, generatedAt: '2026-09-01T00:00:00Z', result: result({ selectedCount: 4 }) }))
  const loaded = await loadPrivatePhotoSnapshot({ env, now: new Date('2026-09-07T20:00:00Z'), maxAgeMs: 86400000 })
  assert.equal(loaded.status, 'stale')
  assert.equal(loaded.result, null)
})

test('invalid snapshot fails closed', async () => {
  const snapshotPath = await pathForTest()
  const env = { ...enabledEnv, CHAD_PRIVATE_PHOTO_SNAPSHOT_PATH: snapshotPath }
  await writeFile(snapshotPath, '{not-json')
  const loaded = await loadPrivatePhotoSnapshot({ env, now: new Date('2026-09-07T20:00:00Z'), maxAgeMs: 86400000 })
  assert.equal(loaded.status, 'invalid')
  assert.equal(loaded.result, null)
})

test('public Vercel runtime disables snapshot access', async () => {
  const loaded = await loadPrivatePhotoSnapshot({
    env: { ...enabledEnv, VERCEL: '1', CHAD_PRIVATE_PHOTO_SNAPSHOT_PATH: '/tmp/should-not-read.json' },
    now: new Date('2026-09-07T20:00:00Z'), maxAgeMs: 86400000,
  })
  assert.equal(loaded.status, 'disabled')
  assert.equal(loaded.result, null)
})
