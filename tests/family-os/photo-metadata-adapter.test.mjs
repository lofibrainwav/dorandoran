import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeAdapterOutput,
  photoMetadataAdapter,
  projectPastJourney,
} from '../../lib/family-os/index.ts'

test('photo metadata becomes historical memory evidence without live presence', () => {
  const [input] = photoMetadataAdapter.normalize({
    id: 'photo-1', sourceRef: 'photo-source:1', evidenceRef: 'photo-evidence:1',
    observedAt: '2026-09-07T20:00:00Z', capturedAt: '2025-06-10T10:00:00Z',
    subjectIds: ['person-a'],
    place: { placeRef: 'place:seoul', label: 'Seoul', coordinates: { latitude: 37.5665, longitude: 126.978 } },
  })
  const observation = normalizeAdapterOutput(photoMetadataAdapter.id, [input])[0]
  assert.equal(observation.kind, 'memory')
  assert.equal(observation.sixW1H.when.start, '2025-06-10T10:00:00Z')
  assert.equal(observation.sixW1H.where.placeRef, 'place:seoul')
  assert.equal(JSON.stringify(observation).includes('confirmed_live'), false)
})
test('raw photo fields are ignored and cannot leak into canonical observation', () => {
  const [input] = photoMetadataAdapter.normalize({
    id: 'photo-2', sourceRef: 'photo-source:2', evidenceRef: 'photo-evidence:2',
    observedAt: '2026-09-07T20:00:00Z', subjectIds: ['person-a'],
    rawExif: { GPSLatitude: 1 }, filePath: '/private/photo.jpg',
    thumbnailUrl: 'file:///private/thumb.jpg', pixelData: 'raw-pixels',
  })
  const json = JSON.stringify(input)
  assert.equal(json.includes('rawExif'), false)
  assert.equal(json.includes('filePath'), false)
  assert.equal(json.includes('thumbnailUrl'), false)
  assert.equal(json.includes('raw-pixels'), false)
})

test('dirty optional capture/place metadata remains unknown', () => {
  const [input] = photoMetadataAdapter.normalize({
    id: 'photo-3', sourceRef: 'photo-source:3', evidenceRef: 'photo-evidence:3',
    observedAt: '2026-09-07T20:00:00Z', capturedAt: 'not-a-date',
    subjectIds: ['person-a'], place: { coordinates: { latitude: 200, longitude: 500 } },
  })
  assert.equal(input.sixW1H.when, undefined)
  assert.equal(input.sixW1H.where, undefined)
})
test('invalid required photo evidence identity fails closed', () => {
  assert.throws(() => photoMetadataAdapter.normalize({
    id: '', sourceRef: 'photo-source:4', evidenceRef: 'photo-evidence:4',
    observedAt: '2026-09-07T20:00:00Z', subjectIds: [],
  }), /PHOTO_METADATA_ID_REQUIRED/)
})

test('photo memory composes directly with Past Journey clustering', () => {
  const normalized = normalizeAdapterOutput(photoMetadataAdapter.id, photoMetadataAdapter.normalize({
    id: 'photo-5', sourceRef: 'photo-source:5', evidenceRef: 'photo-evidence:5',
    observedAt: '2026-09-07T20:00:00Z', capturedAt: '2025-06-10T10:00:00Z',
    subjectIds: ['person-a'],
    place: { placeRef: 'place:seoul', label: 'Seoul', coordinates: { latitude: 37.5665, longitude: 126.978 } },
  }))
  const journey = projectPastJourney({ observations: normalized, subjectId: 'person-a' })
  assert.equal(journey.clusters.length, 1)
  assert.equal(journey.clusters[0].memoryCount, 1)
})
