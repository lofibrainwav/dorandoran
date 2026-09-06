import test from 'node:test'
import assert from 'node:assert/strict'
import { projectWeekBlocks, weekDayLabels } from '../../lib/family-os/index.ts'

function block(id, start, end) {
  return {
    id, type: 'event', reality: { title: id, start, end }, evidenceRefs: [], evidenceState: 'confirmed',
    people: { subjectIds: [], physicalOwnerIds: [], approverIds: [], recipientIds: [] },
    digital: { jobs: [] }, timeEngine: { protected: true }, dependencyIds: [], childBlockIds: [], workState: 'hold',
  }
}

test('week labels are Sunday-first', () => {
  assert.deepEqual(weekDayLabels, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
})

test('projects local event time into Sunday-first day and minute coordinates', () => {
  const projected = projectWeekBlocks([
    block('sun', '2026-09-06T11:00:00-07:00', '2026-09-06T12:20:00-07:00'),
    block('thu', '2026-09-10T18:45:00-07:00', '2026-09-10T19:15:00-07:00'),
  ], '2026-09-06')
  assert.deepEqual(projected.map((x) => [x.blockId, x.dayIndex, x.startMinute]), [
    ['sun', 0, 660], ['thu', 4, 1125],
  ])
})
