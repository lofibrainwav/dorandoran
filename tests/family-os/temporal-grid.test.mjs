import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAdapterOutput, projectTemporalGrid } from '../../lib/family-os/index.ts'

const observations = normalizeAdapterOutput('demo', [
  {
    id: 'a', kind: 'schedule', sourceRef: 's', observedAt: '2026-09-07T18:00:00Z',
    evidenceState: 'confirmed', evidenceRefs: ['e:a'],
    sixW1H: {
      who: { personIds: ['person-a'] }, what: { label: 'A' },
      when: { start: '2026-09-08T00:30:00Z', end: '2026-09-08T01:30:00Z', timeZone: 'America/Los_Angeles' },
    }, continuity: { recordedAt: '2026-09-07T18:00:00Z' },
  },
  {
    id: 'b', kind: 'schedule', sourceRef: 's', observedAt: '2026-09-07T18:00:00Z',
    evidenceState: 'confirmed', evidenceRefs: ['e:b'],
    sixW1H: {
      who: { personIds: ['person-b'] }, what: { label: 'B' },
      when: { start: '2026-10-05T17:00:00Z', end: '2026-10-05T18:00:00Z', timeZone: 'America/Los_Angeles' },
    }, continuity: { recordedAt: '2026-09-07T18:00:00Z' },
  },
])
test('month grid is fixed 42 cells and Sunday-first', () => {
  const grid = projectTemporalGrid({
    scale: 'month', anchorLocalDate: '2026-09-07', timeZone: 'America/Los_Angeles', observations,
  })
  assert.equal(grid.cells.length, 42)
  assert.equal(grid.cells[0].dateKey, '2026-08-30')
  assert.equal(grid.cells[6].dateKey, '2026-09-05')
  assert.equal(grid.cells[7].dateKey, '2026-09-06')
})

test('explicit LA time zone places UTC event on the correct local day', () => {
  const grid = projectTemporalGrid({
    scale: 'month', anchorLocalDate: '2026-09-07', timeZone: 'America/Los_Angeles', observations,
    subjectId: 'person-a',
  })
  const localDay = grid.cells.find((cell) => cell.dateKey === '2026-09-07')
  const utcDay = grid.cells.find((cell) => cell.dateKey === '2026-09-08')
  assert.equal(localDay?.observationCount, 1)
  assert.equal(utcDay?.observationCount, 0)
})
test('year grid has 12 months from the same observation stream', () => {
  const grid = projectTemporalGrid({
    scale: 'year', anchorLocalDate: '2026-09-07', timeZone: 'America/Los_Angeles', observations,
  })
  assert.equal(grid.cells.length, 12)
  assert.equal(grid.cells[8].monthKey, '2026-09')
  assert.equal(grid.cells[8].observationCount, 1)
  assert.equal(grid.cells[9].monthKey, '2026-10')
  assert.equal(grid.cells[9].observationCount, 1)
})

test('person filter excludes unrelated observations without guessing identity', () => {
  const grid = projectTemporalGrid({
    scale: 'year', anchorLocalDate: '2026-09-07', timeZone: 'America/Los_Angeles', observations,
    subjectId: 'person-a',
  })
  assert.equal(grid.cells[8].observationCount, 1)
  assert.equal(grid.cells[9].observationCount, 0)
  assert.deepEqual(grid.cells[8].evidenceRefs, ['e:a'])
})

test('display projection strips evidence refs before client rendering', async () => {
  const { temporalGridForDisplay } = await import('../../lib/family-os/index.ts')
  const grid = projectTemporalGrid({
    scale: 'year', anchorLocalDate: '2026-09-07', timeZone: 'America/Los_Angeles', observations,
  })
  const display = temporalGridForDisplay(grid)
  assert.equal(JSON.stringify(display).includes('e:a'), false)
  assert.equal(JSON.stringify(display).includes('e:b'), false)
})
