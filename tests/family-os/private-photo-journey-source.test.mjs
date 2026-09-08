import test from 'node:test'
import assert from 'node:assert/strict'
import { loadPrivatePhotoJourney } from '../../lib/server/private-photo-journey-source.ts'

const enabledEnv = { CHAD_PRIVATE_LOCAL_UI: '1', APPLE_PHOTOS_SELECTION_SOURCE: '1' }

test('private selected-photo source feeds Past Journey without leaking asset identity', async () => {
  const result = await loadPrivatePhotoJourney({
    env: enabledEnv, observedAt: '2026-09-07T20:00:00Z', maxGapMs: 24 * 60 * 60 * 1000,
    readMetadata: async () => [
      { id: 'asset-1', capturedAt: '2025-06-10T10:00:00Z', coordinates: { latitude: 34.1, longitude: -118.2 } },
      { id: 'asset-2', capturedAt: '2025-06-10T12:00:00Z', coordinates: { latitude: 34.1, longitude: -118.2 } },
    ],
  })
  assert.equal(result.sourceHealth, 'green')
  assert.equal(result.selectedCount, 2)
  assert.equal(result.experience.clusters.length, 1)
  assert.equal(result.experience.stories.length, 1)
  const json = JSON.stringify(result)
  assert.equal(json.includes('asset-1'), false)
  assert.equal(json.includes('apple-photos:'), false)
})

test('Photos source is disabled on public/Vercel runtime even if opt-in is present', async () => {
  const result = await loadPrivatePhotoJourney({
    env: { ...enabledEnv, VERCEL: '1' }, observedAt: '2026-09-07T20:00:00Z', maxGapMs: 3600000,
    readMetadata: async () => { throw new Error('must not execute') },
  })
  assert.equal(result, null)
})

test('transport failure reports failure without invented memories', async () => {
  const result = await loadPrivatePhotoJourney({
    env: enabledEnv, observedAt: '2026-09-07T20:00:00Z', maxGapMs: 3600000,
    readMetadata: async () => { throw new Error('AppleEvent timed out') },
  })
  assert.equal(result.sourceHealth, 'failure')
  assert.equal(result.selectedCount, 0)
  assert.equal(result.experience.clusters.length, 0)
  assert.equal(result.experience.stories.length, 0)
})
