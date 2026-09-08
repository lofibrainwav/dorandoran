import test from 'node:test'
import assert from 'node:assert/strict'
import { projectPastJourneyExperience } from '../../lib/family-os/index.ts'

function observation(id, options = {}) {
  return {
    id, adapterId: 'experience-test', kind: options.kind ?? 'memory',
    sourceRef: `private:${id}`, observedAt: '2026-09-07T20:00:00Z',
    evidenceState: options.evidenceState ?? 'confirmed', evidenceRefs: [`e:${id}`],
    sixW1H: {
      who: { personIds: [options.personId ?? 'person-a'] },
      when: { start: options.start ?? '2025-06-10T10:00:00Z' },
      ...(options.place ? { where: options.place } : {}),
    },
    continuity: { recordedAt: '2026-09-07T20:00:00Z' },
  }
}

const located = observation('located', {
  place: { placeRef: 'place:seoul', label: 'Seoul', coordinates: { latitude: 37.5665, longitude: 126.978 } },
})
const unlocated = observation('unlocated', { start: '2025-06-10T12:00:00Z' })

test('one experience entrypoint composes globe clusters and trip stories', () => {
  const experience = projectPastJourneyExperience({
    observations: [located, unlocated], subjectId: 'person-a', maxGapMs: 24 * 60 * 60 * 1000,
  })
  assert.equal(experience.clusters.length, 1)
  assert.equal(experience.clusters[0].label, 'Seoul')
  assert.equal(experience.stories.length, 1)
  assert.equal(experience.stories[0].memoryCount, 2)
  assert.deepEqual(experience.stories[0].places, ['Seoul'])
  assert.equal(experience.unlocatedMemoryCount, 1)
  assert.equal(experience.ungroupedMemoryCount, 0)
})

test('experience display contains no canonical provenance refs', () => {
  const json = JSON.stringify(projectPastJourneyExperience({ observations: [located], maxGapMs: 3600000 }))
  for (const forbidden of ['e:located', 'private:located', 'place:seoul', 'evidenceRefs', 'sourceRef', 'placeRef']) {
    assert.equal(json.includes(forbidden), false, `leaked ${forbidden}`)
  }
})

test('non-memory evidence cannot enter either experience axis', () => {
  const noise = [
    observation('schedule', { kind: 'schedule', place: { placeRef: 'p:s', label: 'Schedule', coordinates: { latitude: 1, longitude: 1 } } }),
    observation('stale', { evidenceState: 'stale', place: { placeRef: 'p:x', label: 'Stale', coordinates: { latitude: 2, longitude: 2 } } }),
    observation('other', { personId: 'person-b', place: { placeRef: 'p:o', label: 'Other', coordinates: { latitude: 3, longitude: 3 } } }),
  ]
  const experience = projectPastJourneyExperience({ observations: noise, subjectId: 'person-a', maxGapMs: 3600000 })
  assert.equal(experience.clusters.length, 0)
  assert.equal(experience.stories.length, 0)
})
