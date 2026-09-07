import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createAdapterRegistry,
  createConnectionRegistry,
  findAdapter,
  findCapabilitySources,
  normalizeAdapterOutput,
  projectContextStory,
  resolvePresenceLabel,
  sortObservationsByContinuity,
} from '../../lib/family-os/index.ts'

test('capability lookup is provider-neutral and ignores unavailable connections', () => {
  const registry = createConnectionRegistry([
    { id: 'c1', providerKey: 'provider-a', accountRef: 'acct-a', status: 'connected', capabilities: [{ id: 'time.events.read', operations: ['read'] }] },
    { id: 'c2', providerKey: 'provider-b', accountRef: 'acct-b', status: 'revoked', capabilities: [{ id: 'time.events.read', operations: ['read'] }] },
  ])
  assert.deepEqual(findCapabilitySources(registry, 'time.events.read').map((item) => item.connectionId), ['c1'])
})

test('adapter output preserves unknown fields instead of inventing 6W1H answers', () => {
  const observations = normalizeAdapterOutput('adapter-x', [{
    id: 'obs-1',
    kind: 'schedule',
    sixW1H: { who: { personIds: ['person-1'] }, what: { label: 'Practice' } },
    sourceRef: 'source-1',
    observedAt: '2026-09-07T18:00:00Z',
    evidenceState: 'confirmed',
    evidenceRefs: ['e1'],
    continuity: { recordedAt: '2026-09-07T18:00:00Z' },
  }])
  assert.equal(observations[0].sixW1H.where, undefined)
  assert.equal(observations[0].sixW1H.why, undefined)
  assert.equal(observations[0].adapterId, 'adapter-x')
})

test('scheduled place never renders as live presence', () => {
  assert.equal(resolvePresenceLabel({ state: 'scheduled', placeRef: 'place-1', observedAt: '2026-09-07T18:00:00Z', evidenceRefs: ['e1'] }), 'Scheduled')
  assert.equal(resolvePresenceLabel({ state: 'confirmed_live', placeRef: 'place-1', observedAt: '2026-09-07T18:00:00Z', evidenceRefs: ['e2'] }), 'Live')
})

test('story projection uses evidence-backed stages and does not require a named person', () => {
  const story = projectContextStory({
    subjectIds: ['person-42'],
    now: 'At school',
    next: 'Practice at 3:00 PM',
    change: undefined,
    outcome: 'Pickup owner is ready',
    evidenceRefs: ['e1', 'e2'],
  })
  assert.deepEqual(story.stages.map((stage) => stage.key), ['now', 'next', 'outcome'])
  assert.deepEqual(story.subjectIds, ['person-42'])
})


test('adapter registry selects by declared input kind rather than hardcoded provider branches', () => {
  const adapter = { id: 'adapter-any', inputKind: 'school.assignment', normalize: () => [] }
  const registry = createAdapterRegistry([adapter])
  assert.equal(findAdapter(registry, 'school.assignment')?.id, 'adapter-any')
  assert.equal(findAdapter(registry, 'unknown.kind'), undefined)
})

test('Yeong continuity sorts observations oldest to newest without a composite family score', () => {
  const base = {
    kind: 'memory', sixW1H: {}, sourceRef: 's', observedAt: '2026-09-07T18:00:00Z',
    evidenceState: 'confirmed', evidenceRefs: ['e'], adapterId: 'a',
  }
  const sorted = sortObservationsByContinuity([
    { ...base, id: 'new', continuity: { recordedAt: '2026-09-07T18:00:00Z' } },
    { ...base, id: 'old', continuity: { recordedAt: '2025-09-07T18:00:00Z' } },
  ])
  assert.deepEqual(sorted.map((item) => item.id), ['old', 'new'])
})
