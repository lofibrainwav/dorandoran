import assert from 'node:assert/strict'
import test from 'node:test'
import { buildArtifactRegistry } from '../../lib/family-os/artifact-registry.ts'
import { createFamilyDailyCapsule } from '../../lib/family-os/daily-capsule.ts'

const registry = buildArtifactRegistry([{
  id: 'artifact-1',
  kind: 'resume',
  digest: `sha256:${'a'.repeat(64)}`,
  observedAt: '2026-09-10T10:00:00.000Z',
  state: 'confirmed',
  provenance: { sourceRef: 'drive:file-1', evidenceRefs: ['evidence-1'] },
}])

test('daily capsule aggregates authorized typed states without raw lifecycle content', () => {
  const capsule = createFamilyDailyCapsule({
    date: '2026-09-10',
    artifactRegistry: registry,
    captures: [{ kind: 'want' }, { kind: 'fact' }],
    candidates: [{ state: 'proposed' }, { state: 'accepted' }],
    tasks: [{ workState: 'open' }, { workState: 'done' }],
  })

  assert.deepEqual(capsule.captures, {
    total: 2,
    byKind: { want: 1, decision: 0, fact: 1, question: 0, final_artifact: 0 },
  })
  assert.deepEqual(capsule.candidates, {
    total: 2,
    byState: { proposed: 1, accepted: 1, declined: 0, expired: 0 },
  })
  assert.deepEqual(capsule.tasks.byState, { hold: 0, open: 1, in_progress: 0, risk: 0, done: 1 })
  assert.deepEqual(capsule.artifacts.artifacts, [{ id: 'artifact-1', kind: 'resume', state: 'confirmed' }])
  assert.equal(JSON.stringify(capsule).includes('evidence-1'), false)
  assert.equal(JSON.stringify(capsule).includes('drive:file-1'), false)
})

test('daily capsule fails closed on a state outside the lifecycle contract', () => {
  assert.throws(
    () => createFamilyDailyCapsule({
      date: '2026-09-10', artifactRegistry: registry, captures: [], candidates: [{ state: 'unknown' }], tasks: [],
    }),
    /DAILY_CAPSULE_CANDIDATE_STATE_INVALID/,
  )
})
