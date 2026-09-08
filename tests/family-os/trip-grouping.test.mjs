import test from 'node:test'
import assert from 'node:assert/strict'
import { groupPastJourneyTrips } from '../../lib/family-os/index.ts'

function observation(id, start, options = {}) {
  return {
    id, adapterId: 'memory-test', kind: options.kind ?? 'memory',
    sourceRef: `source:${id}`, observedAt: '2026-09-07T20:00:00Z',
    evidenceState: options.evidenceState ?? 'confirmed', evidenceRefs: [`e:${id}`],
    sixW1H: {
      who: { personIds: [options.personId ?? 'person-a'] },
      ...(start ? { when: { start } } : {}),
      ...(options.placeRef ? { where: { placeRef: options.placeRef } } : {}),
    },
    continuity: { recordedAt: '2026-09-07T20:00:00Z' },
  }
}

test('confirmed memories partition deterministically by explicit time-gap policy', () => {
  const result = groupPastJourneyTrips({
    observations: [
      observation('m3', '2025-06-13T10:00:00Z'),
      observation('m1', '2025-06-10T10:00:00Z'),
      observation('m2', '2025-06-10T22:00:00Z'),
    ],
    subjectId: 'person-a', maxGapMs: 24 * 60 * 60 * 1000,
  })
  assert.equal(result.groups.length, 2)
  assert.deepEqual(result.groups.map((group) => group.memoryCount), [2, 1])
  assert.equal(result.groups[0].start, '2025-06-10T10:00:00Z')
  assert.equal(result.groups[0].end, '2025-06-10T22:00:00Z')
  assert.equal('label' in result.groups[0], false)
})

test('gap exactly on the boundary stays in the same trip group', () => {
  const result = groupPastJourneyTrips({
    observations: [
      observation('m1', '2025-06-10T10:00:00Z'),
      observation('m2', '2025-06-11T10:00:00Z'),
    ],
    maxGapMs: 24 * 60 * 60 * 1000,
  })
  assert.equal(result.groups.length, 1)
  assert.equal(result.groups[0].memoryCount, 2)
})

test('grouping excludes non-confirmed/non-memory/other-subject items and keeps only explicit place refs', () => {
  const result = groupPastJourneyTrips({
    observations: [
      observation('m1', '2025-06-10T10:00:00Z', { placeRef: 'place:seoul' }),
      observation('m2', '2025-06-10T12:00:00Z'),
      observation('stale', '2025-06-10T13:00:00Z', { evidenceState: 'stale' }),
      observation('schedule', '2025-06-10T14:00:00Z', { kind: 'schedule' }),
      observation('other', '2025-06-10T15:00:00Z', { personId: 'person-b' }),
      observation('unknown-time', null),
    ],
    subjectId: 'person-a', maxGapMs: 24 * 60 * 60 * 1000,
  })
  assert.equal(result.groups.length, 1)
  assert.deepEqual(result.groups[0].placeRefs, ['place:seoul'])
  assert.deepEqual(result.groups[0].evidenceRefs, ['e:m1', 'e:m2'])
  assert.equal(result.ungroupedMemoryCount, 1)
})

test('invalid grouping policy fails closed', () => {
  assert.throws(() => groupPastJourneyTrips({ observations: [], maxGapMs: 0 }), /TRIP_GROUPING_MAX_GAP_INVALID/)
})
