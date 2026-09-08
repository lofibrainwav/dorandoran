import test from 'node:test'
import assert from 'node:assert/strict'
import { readSelectedApplePhotosMetadata } from '../../lib/server/apple-photos-selection-transport.ts'

test('Apple Photos transport requests only id/date/location and sanitizes runner output', async () => {
  let script = ''
  const rows = await readSelectedApplePhotosMetadata({ limit: 20 }, async (value) => {
    script = value
    return JSON.stringify([{ id: 'asset-1', capturedAt: '2025-06-10T10:00:00.000Z', coordinates: { latitude: 34.1, longitude: -118.2 }, filename: 'private.jpg' }])
  })
  assert.deepEqual(rows, [{ id: 'asset-1', capturedAt: '2025-06-10T10:00:00.000Z', coordinates: { latitude: 34.1, longitude: -118.2 } }])
  assert.match(script, /selection/)
  assert.match(script, /\.id\(\)/)
  assert.match(script, /\.date\(\)/)
  assert.match(script, /\.location\(\)/)
  for (const forbidden of ['filename', 'description', 'pixel', 'width', 'height']) assert.equal(script.includes(forbidden), false)
})

test('invalid optional metadata is omitted and reads are bounded', async () => {
  const rows = await readSelectedApplePhotosMetadata({ limit: 1 }, async () => JSON.stringify([
    { id: 'asset-1', capturedAt: 'bad-date', coordinates: { latitude: 999, longitude: 999 } },
    { id: 'asset-2', capturedAt: '2025-01-01T00:00:00Z' },
  ]))
  assert.deepEqual(rows, [{ id: 'asset-1' }])
  await assert.rejects(() => readSelectedApplePhotosMetadata({ limit: 0 }, async () => '[]'), /APPLE_PHOTOS_LIMIT_INVALID/)
})
