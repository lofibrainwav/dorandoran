import test from 'node:test'
import assert from 'node:assert/strict'
import { projectAppleDigitalAtomSources } from '../../lib/server/apple-digital-atom-read.ts'

test('apple digital atom read model distinguishes connected, stale, and unconnected sources', async () => {
  const now = new Date('2026-09-10T12:00:00.000Z')
  const projection = projectAppleDigitalAtomSources({
    now,
    maxAgeMs: 24 * 60 * 60 * 1000,
    rows: [
      { source: 'calendar', eventCount: 3, lastObservedAt: '2026-09-10T11:00:00.000Z', cursorUpdatedAt: '2026-09-10T11:00:00.000Z' },
      { source: 'reminders', eventCount: 2, lastObservedAt: '2026-09-08T11:00:00.000Z', cursorUpdatedAt: '2026-09-08T11:00:00.000Z' },
    ],
  })
  assert.equal(projection.status, 'partial')
  assert.deepEqual(projection.sources.map((source) => [source.source, source.state, source.eventCount]), [
    ['calendar', 'connected', 3],
    ['reminders', 'stale', 2],
    ['shortcuts', 'unconnected', 0],
    ['home', 'unconnected', 0],
  ])
})

test('apple digital atom read model exposes no metadata payload', async () => {
  const projection = projectAppleDigitalAtomSources({ now: new Date('2026-09-10T12:00:00.000Z'), maxAgeMs: 60_000, rows: [] })
  assert.equal(projection.status, 'unconnected')
  assert.equal('metadata' in projection, false)
  assert.equal('title' in projection.sources[0], false)
})
