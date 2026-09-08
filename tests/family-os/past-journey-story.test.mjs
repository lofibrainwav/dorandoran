import test from 'node:test'
import assert from 'node:assert/strict'
import { groupPastJourneyTrips, projectPastJourneyStories } from '../../lib/family-os/index.ts'

function memory(id, start, options = {}) {
  return {
    id, adapterId: 'story-test', kind: options.kind ?? 'memory',
    sourceRef: `private:${id}`, observedAt: '2026-09-07T20:00:00Z',
    evidenceState: options.evidenceState ?? 'confirmed', evidenceRefs: [`e:${id}`],
    sixW1H: {
      who: { personIds: [options.personId ?? 'person-a'] },
      when: { start },
      ...(options.label ? { where: { placeRef: `place:${id}`, label: options.label } } : {}),
    },
    continuity: { recordedAt: '2026-09-07T20:00:00Z' },
  }
}

const observations = [
  memory('a', '2025-06-10T10:00:00Z', { label: 'Seoul' }),
  memory('b', '2025-06-10T20:00:00Z', { label: 'Seoul' }),
  memory('c', '2025-06-11T08:00:00Z', { label: 'Busan' }),
]

test('story projects count, time, and only explicit place labels', () => {
  const grouping = groupPastJourneyTrips({ observations, subjectId: 'person-a', maxGapMs: 24 * 60 * 60 * 1000 })
  const story = projectPastJourneyStories({ grouping, observations, subjectId: 'person-a' })
  assert.equal(story.stories.length, 1)
  assert.deepEqual(story.stories[0], {
    id: 'past-story-1', start: '2025-06-10T10:00:00Z', end: '2025-06-11T08:00:00Z',
    memoryCount: 3, places: ['Seoul', 'Busan'], summary: '3 memories · Seoul, Busan',
  })
})

test('story display strips canonical provenance refs', () => {
  const grouping = groupPastJourneyTrips({ observations, maxGapMs: 24 * 60 * 60 * 1000 })
  const json = JSON.stringify(projectPastJourneyStories({ grouping, observations }))
  assert.equal(json.includes('e:a'), false)
  assert.equal(json.includes('private:a'), false)
  assert.equal(json.includes('place:a'), false)
  assert.equal(json.includes('evidenceRefs'), false)
  assert.equal(json.includes('sourceRef'), false)
  assert.equal(json.includes('placeRef'), false)
})

test('missing place labels stay unknown rather than inferred', () => {
  const items = [memory('unknown', '2025-01-01T10:00:00Z')]
  const grouping = groupPastJourneyTrips({ observations: items, maxGapMs: 3600000 })
  const story = projectPastJourneyStories({ grouping, observations: items })
  assert.deepEqual(story.stories[0].places, [])
  assert.equal(story.stories[0].summary, '1 memory')
})

test('non-memory, stale, and unrelated observations cannot add story labels', () => {
  const eligible = [memory('ok', '2025-06-10T10:00:00Z', { label: 'Seoul' })]
  const noise = [
    memory('schedule', '2025-06-10T11:00:00Z', { kind: 'schedule', label: 'Secret schedule place' }),
    memory('stale', '2025-06-10T12:00:00Z', { evidenceState: 'stale', label: 'Stale place' }),
    memory('other', '2025-06-10T13:00:00Z', { personId: 'person-b', label: 'Other place' }),
  ]
  const grouping = groupPastJourneyTrips({ observations: [...eligible, ...noise], subjectId: 'person-a', maxGapMs: 3600000 })
  const story = projectPastJourneyStories({ grouping, observations: [...eligible, ...noise], subjectId: 'person-a' })
  assert.deepEqual(story.stories[0].places, ['Seoul'])
  assert.equal(story.stories[0].summary, '1 memory · Seoul')
})
