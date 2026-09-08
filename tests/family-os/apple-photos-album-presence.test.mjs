import test from 'node:test'
import assert from 'node:assert/strict'
import { readApplePhotosAlbumMetadata } from '../../lib/server/apple-photos-album-transport.ts'
import { loadPrivatePhotoJourney } from '../../lib/server/private-photo-journey-source.ts'

const env = {
  CHAD_PRIVATE_LOCAL_UI: '1',
  APPLE_PHOTOS_ALBUM_NAME: 'DoranDoran',
}

test('album transport distinguishes configured album missing from empty album', async () => {
  await assert.rejects(
    () => readApplePhotosAlbumMetadata({ albumName: 'DoranDoran', limit: 20 }, async () => JSON.stringify({ albumExists: false, rows: [] })),
    /APPLE_PHOTOS_ALBUM_NOT_FOUND/,
  )
  const empty = await readApplePhotosAlbumMetadata(
    { albumName: 'DoranDoran', limit: 20 },
    async () => JSON.stringify({ albumExists: true, rows: [] }),
  )
  assert.deepEqual(empty, [])
})

test('configured but missing album projects partial source truth', async () => {
  const result = await loadPrivatePhotoJourney({
    env,
    observedAt: '2026-09-07T20:00:00Z',
    maxGapMs: 3600000,
    readAlbumMetadata: async () => { throw new Error('APPLE_PHOTOS_ALBUM_NOT_FOUND') },
  })
  assert.equal(result.source, 'apple-photos-album')
  assert.equal(result.sourceHealth, 'partial')
  assert.equal(result.sourceState, 'album-missing')
  assert.equal(result.selectedCount, 0)
  assert.equal(result.experience.clusters.length, 0)
  assert.equal(result.experience.stories.length, 0)
})

test('album transport failure stays failure rather than partial', async () => {
  const result = await loadPrivatePhotoJourney({
    env, observedAt: '2026-09-07T20:00:00Z', maxGapMs: 3600000,
    readAlbumMetadata: async () => { throw new Error('sqlite read failed') },
  })
  assert.equal(result.sourceHealth, 'failure')
  assert.equal(result.sourceState, 'failure')
})
