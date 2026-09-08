import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeAdapterOutput,
  projectPastJourney,
  pastJourneyForDisplay,
} from '../../lib/family-os/index.ts'

const memories = normalizeAdapterOutput('photo-memory-demo', [
  {
    id: 'm1', kind: 'memory', sourceRef: 'photo:1', observedAt: '2026-09-07T20:00:00Z',
    evidenceState: 'confirmed', evidenceRefs: ['photo-evidence-1'],
    sixW1H: {
      who: { personIds: ['person-a'] }, what: { label: 'Family memory' },
      when: { start: '2025-06-10T10:00:00Z' },
      where: { placeRef: 'place:seoul', label: 'Seoul', coordinates: { latitude: 37.5665, longitude: 126.978 } },
    }, continuity: { recordedAt: '2026-09-07T20:00:00Z' },
  },
  {
    id: 'm2', kind: 'memory', sourceRef: 'photo:2', observedAt: '2026-09-07T20:01:00Z',
    evidenceState: 'confirmed', evidenceRefs: ['photo-evidence-2'],
    sixW1H: {
      who: { personIds: ['person-a'] }, what: { label: 'Family memory' },
      when: { start: '2025-06-12T10:00:00Z' },
      where: { placeRef: 'place:seoul', label: 'Seoul', coordinates: { latitude: 37.5665, longitude: 126.978 } },
    }, continuity: { recordedAt: '2026-09-07T20:01:00Z' },
  },
])

test('Past Journey clusters explicit memories by placeRef', () => {
  const journey = projectPastJourney({ observations: memories, subjectId: 'person-a' })
  assert.equal(journey.clusters.length, 1)
  assert.equal(journey.clusters[0].label, 'Seoul')
  assert.equal(journey.clusters[0].memoryCount, 2)
  assert.equal(journey.clusters[0].firstSeen, '2025-06-10T10:00:00Z')
  assert.equal(journey.clusters[0].lastSeen, '2025-06-12T10:00:00Z')
})

test('Past Journey display strips source and evidence refs', () => {
  const display = pastJourneyForDisplay(projectPastJourney({ observations: memories, subjectId: 'person-a' }))
  const json = JSON.stringify(display)
  assert.equal(json.includes('photo-evidence'), false)
  assert.equal(json.includes('photo:1'), false)
  assert.equal(display.clusters[0].coordinates.latitude, 37.5665)
})
test('unlocated memory stays countable but cannot become a globe cluster', () => {
  const unlocated = normalizeAdapterOutput('memory-demo', [{
    id: 'm3', kind: 'memory', sourceRef: 'memory:3', observedAt: '2026-09-07T20:02:00Z',
    evidenceState: 'confirmed', evidenceRefs: ['memory-evidence-3'],
    sixW1H: {
      who: { personIds: ['person-a'] }, what: { label: 'Memory without place' },
      when: { start: '2024-01-01T00:00:00Z' },
    }, continuity: { recordedAt: '2026-09-07T20:02:00Z' },
  }])
  const journey = projectPastJourney({ observations: [...memories, ...unlocated], subjectId: 'person-a' })
  assert.equal(journey.clusters.length, 1)
  assert.equal(journey.unlocatedMemoryCount, 1)
})

test('schedule observations and other people never become journey memories', () => {
  const extra = normalizeAdapterOutput('calendar-demo', [{
    id: 's1', kind: 'schedule', sourceRef: 'calendar:1', observedAt: '2026-09-07T20:00:00Z',
    evidenceState: 'confirmed', evidenceRefs: ['calendar-evidence-1'],
    sixW1H: { who: { personIds: ['person-a'] }, what: { label: 'Trip plan' }, when: { start: '2027-01-01T00:00:00Z' } },
    continuity: { recordedAt: '2026-09-07T20:00:00Z' },
  }])
  const journey = projectPastJourney({ observations: [...memories, ...extra], subjectId: 'person-b' })
  assert.equal(journey.clusters.length, 0)
  assert.equal(journey.unlocatedMemoryCount, 0)
})
test('coordinate-only memory becomes an exact globe cluster without inventing a place name', () => {
  const coordinateOnly = normalizeAdapterOutput('memory-demo', [{
    id: 'm4', kind: 'memory', sourceRef: 'memory:4', observedAt: '2026-09-07T20:03:00Z',
    evidenceState: 'confirmed', evidenceRefs: ['memory-evidence-4'],
    sixW1H: {
      who: { personIds: ['person-a'] },
      when: { start: '2025-07-01T10:00:00Z' },
      where: { coordinates: { latitude: 34.1234, longitude: -118.1234 } },
    }, continuity: { recordedAt: '2026-09-07T20:03:00Z' },
  }])
  const journey = projectPastJourney({ observations: coordinateOnly, subjectId: 'person-a' })
  assert.equal(journey.clusters.length, 1)
  assert.equal(journey.clusters[0].label, 'Location recorded')
  assert.deepEqual(journey.clusters[0].coordinates, { latitude: 34.1234, longitude: -118.1234 })
  assert.equal(journey.unlocatedMemoryCount, 0)
})
