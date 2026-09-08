import test from 'node:test'
import assert from 'node:assert/strict'
import { readApplePhotosAlbumMetadata } from '../../lib/server/apple-photos-album-transport.ts'

test('album transport pins osxphotos and exposes only metadata fields', async () => {
  let call
  const rows = await readApplePhotosAlbumMetadata({ albumName: 'DoranDoran', limit: 20 }, async (command, args) => {
    call = { command, args }
    return JSON.stringify([
      { id: 'asset-1', capturedAt: '2025-06-10T10:00:00', coordinates: { latitude: 34.1, longitude: -118.2 }, filename: 'secret.jpg' },
    ])
  })
  assert.equal(call.command.endsWith('/uv') || call.command === 'uv', true)
  assert.equal(call.args.includes('osxphotos==0.76.1'), true)
  assert.equal(call.args.includes('DoranDoran'), true)
  assert.deepEqual(rows, [{ id: 'asset-1', capturedAt: '2025-06-10T10:00:00', coordinates: { latitude: 34.1, longitude: -118.2 } }])
})

test('album transport fails closed on invalid config', async () => {
  await assert.rejects(
    () => readApplePhotosAlbumMetadata({ albumName: '', limit: 20 }, async () => '[]'),
    /APPLE_PHOTOS_ALBUM_NAME_REQUIRED/,
  )
  await assert.rejects(
    () => readApplePhotosAlbumMetadata({ albumName: 'DoranDoran', limit: 101 }, async () => '[]'),
    /APPLE_PHOTOS_LIMIT_INVALID/,
  )
})

test('dirty optional album metadata is omitted', async () => {
  const rows = await readApplePhotosAlbumMetadata({ albumName: 'DoranDoran', limit: 1 }, async () => JSON.stringify([
    { id: 'asset-1', capturedAt: 'bad', coordinates: { latitude: 999, longitude: -999 } },
  ]))
  assert.deepEqual(rows, [{ id: 'asset-1' }])
})
