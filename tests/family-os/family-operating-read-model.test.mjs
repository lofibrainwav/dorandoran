import test from 'node:test'
import assert from 'node:assert/strict'
import { projectFamilyOperatingPerson } from '../../lib/family-os/index.ts'

const base = {
  kind: 'schedule', sourceRef: 'calendar-source', evidenceState: 'confirmed',
  adapterId: 'calendar-adapter', authorityRef: 'calendar-authority',
}

function observation({ id, personId, label, start, end, where }) {
  return {
    ...base,
    id,
    observedAt: start,
    evidenceRefs: [`evidence-${id}`],
    sixW1H: {
      who: { personIds: [personId] }, what: { label },
      when: { start, end, timeZone: 'America/Los_Angeles' },
      ...(where ? { where } : {}),
    },
    continuity: { recordedAt: start },
  }
}

test('operating read model derives NOW, NEXT, and scheduled place from subject evidence', () => {
  const result = projectFamilyOperatingPerson({
    personId: 'person-1', label: 'Person One', now: '2026-09-07T19:00:00Z',
    observations: [
      observation({ id: 'current', personId: 'person-1', label: 'School day', start: '2026-09-07T16:00:00Z', end: '2026-09-07T21:00:00Z', where: { label: 'Los Angeles area', coordinates: { latitude: 34.05, longitude: -118.24 } } }),
      observation({ id: 'next', personId: 'person-1', label: 'Afternoon activity', start: '2026-09-07T22:00:00Z', end: '2026-09-07T23:00:00Z' }),
    ],
  })
  assert.equal(result.now, 'School day')
  assert.equal(result.next, 'Afternoon activity')
  assert.equal(result.place.state, 'Scheduled')
  assert.equal(result.place.label, 'Los Angeles area')
})

test('operating read model ignores other people and preserves unknown place', () => {
  const result = projectFamilyOperatingPerson({
    personId: 'person-1', label: 'Person One', now: '2026-09-07T19:00:00Z',
    observations: [
      observation({ id: 'other', personId: 'person-2', label: 'Private other-person event', start: '2026-09-07T18:00:00Z', end: '2026-09-07T20:00:00Z', where: { label: 'Other place' } }),
      observation({ id: 'mine', personId: 'person-1', label: 'Practice', start: '2026-09-07T22:00:00Z', end: '2026-09-07T23:00:00Z' }),
    ],
  })
  assert.equal(result.now, 'Unknown')
  assert.equal(result.next, 'Practice')
  assert.equal(result.place.state, 'Unknown')
  assert.equal(JSON.stringify(result).includes('Private other-person event'), false)
  assert.equal(JSON.stringify(result).includes('Other place'), false)
})

test('specialist modules are passed through by declared id, not inferred from a name', () => {
  const result = projectFamilyOperatingPerson({
    personId: 'person-42', label: 'Any Person', now: '2026-09-07T19:00:00Z', observations: [],
    modules: [{ id: 'learning', label: 'Learning' }, { id: 'schedule', label: 'Schedule' }],
  })
  assert.deepEqual(result.modules, [
    { id: 'learning', label: 'Learning' },
    { id: 'schedule', label: 'Schedule' },
  ])
})

test('operating read model keeps WHAT separate from explicit WHEN projections', () => {
  const result = projectFamilyOperatingPerson({
    personId: 'person-1', label: 'Person One', now: '2026-09-07T19:00:00Z',
    observations: [
      observation({ id: 'current-time', personId: 'person-1', label: 'School day', start: '2026-09-07T16:00:00Z', end: '2026-09-07T21:00:00Z' }),
      observation({ id: 'next-time', personId: 'person-1', label: 'Practice', start: '2026-09-07T22:00:00Z', end: '2026-09-07T23:00:00Z' }),
    ],
  })
  assert.equal(result.now, 'School day')
  assert.equal(result.next, 'Practice')
  assert.deepEqual(result.nowWhen, { start: '2026-09-07T16:00:00Z', end: '2026-09-07T21:00:00Z', timeZone: 'America/Los_Angeles' })
  assert.deepEqual(result.nextWhen, { start: '2026-09-07T22:00:00Z', end: '2026-09-07T23:00:00Z', timeZone: 'America/Los_Angeles' })
})
