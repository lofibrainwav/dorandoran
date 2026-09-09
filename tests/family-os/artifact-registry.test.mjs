import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildArtifactRegistry,
  reconcileArtifactRegistries,
  createDailyArtifactCapsule,
} from '../../lib/family-os/artifact-registry.ts'

function artifact(overrides = {}) {
  return {
    id: 'artifact-1',
    kind: 'document',
    digest: 'sha256:a',
    observedAt: '2026-09-08T10:00:00Z',
    state: 'confirmed',
    provenance: { sourceRef: 'private:source-1', evidenceRefs: ['evidence-1'] },
    ...overrides,
  }
}

test('empty input produces a deterministic empty registry', () => {
  assert.deepEqual(buildArtifactRegistry([]), {
    version: 1,
    artifacts: [],
    conflicts: [],
  })
})

test('same id and digest converge while provenance is deterministically retained', () => {
  const result = buildArtifactRegistry([
    artifact({ provenance: { sourceRef: 'source:b', evidenceRefs: ['e2'] } }),
    artifact({ provenance: { sourceRef: 'source:a', evidenceRefs: ['e1'] } }),
  ])
  assert.equal(result.artifacts.length, 1)
  assert.deepEqual(result.artifacts[0].provenance, {
    sourceRefs: ['source:a', 'source:b'], evidenceRefs: ['e1', 'e2'],
  })
  assert.deepEqual(result.conflicts, [])
})

test('same id with different digests is a conflict and neither observation wins', () => {
  const result = buildArtifactRegistry([artifact(), artifact({ digest: 'sha256:b' })])
  assert.equal(result.artifacts.length, 1)
  assert.equal(result.artifacts[0].state, 'conflict')
  assert.deepEqual(result.artifacts[0].digests, ['sha256:a', 'sha256:b'])
  assert.deepEqual(result.conflicts, ['artifact-1'])
})

test('malformed timestamps and missing digests fail closed', () => {
  assert.throws(() => buildArtifactRegistry([artifact({ observedAt: 'not-a-date' })]), /ARTIFACT_OBSERVED_AT_INVALID/)
  assert.throws(() => buildArtifactRegistry([artifact({ digest: '' })]), /ARTIFACT_DIGEST_REQUIRED/)
})

test('reconcile emits added, updated, unchanged, stale, and conflict as typed statuses', () => {
  const before = buildArtifactRegistry([
    artifact({ id: 'same', digest: 'sha256:same' }),
    artifact({ id: 'updated', digest: 'sha256:old' }),
    artifact({ id: 'stale', observedAt: '2026-09-01T10:00:00Z' }),
  ])
  const after = buildArtifactRegistry([
    artifact({ id: 'same', digest: 'sha256:same' }),
    artifact({ id: 'updated', digest: 'sha256:new' }),
    artifact({ id: 'stale', observedAt: '2026-09-01T10:00:00Z' }),
    artifact({ id: 'added' }),
    artifact({ id: 'conflict', digest: 'sha256:one' }),
    artifact({ id: 'conflict', digest: 'sha256:two' }),
  ])
  const result = reconcileArtifactRegistries({
    before, after, cutoff: '2026-09-02T00:00:00Z', now: '2026-09-08T00:00:00Z',
  })
  assert.deepEqual(result.entries.map((entry) => [entry.id, entry.status]), [
    ['added', 'added'], ['conflict', 'conflict'], ['same', 'unchanged'],
    ['stale', 'stale'], ['updated', 'updated'],
  ])
})

test('an artifact absent from the after snapshot is surfaced as stale', () => {
  const before = buildArtifactRegistry([artifact({ id: 'gone' })])
  const after = buildArtifactRegistry([])
  const result = reconcileArtifactRegistries({
    before, after, cutoff: '2026-09-02T00:00:00Z', now: '2026-09-08T00:00:00Z',
  })
  assert.deepEqual(result.entries, [{ id: 'gone', kind: 'document', status: 'stale', state: 'stale' }])
})

test('cutoff is exclusive, now and cutoff are required valid caller inputs', () => {
  const registry = buildArtifactRegistry([artifact({ observedAt: '2026-09-02T00:00:00Z' })])
  const result = reconcileArtifactRegistries({
    before: buildArtifactRegistry([]), after: registry,
    cutoff: '2026-09-02T00:00:00Z', now: '2026-09-02T00:00:01Z',
  })
  assert.equal(result.entries[0].status, 'added')
  assert.throws(() => reconcileArtifactRegistries({ before: registry, after: registry, cutoff: 'bad', now: '2026-09-02T00:00:00Z' }), /ARTIFACT_CUTOFF_INVALID/)
  assert.throws(() => reconcileArtifactRegistries({ before: registry, after: registry, cutoff: '2026-09-02T00:00:00Z', now: 'bad' }), /ARTIFACT_NOW_INVALID/)
})

test('reconcile is repeatable and does not mutate its snapshots', () => {
  const before = buildArtifactRegistry([artifact()])
  const after = buildArtifactRegistry([artifact({ observedAt: '2026-09-08T11:00:00Z' })])
  const input = { before, after, cutoff: '2026-09-01T00:00:00Z', now: '2026-09-08T12:00:00Z' }
  const first = reconcileArtifactRegistries(input)
  const second = reconcileArtifactRegistries(input)
  assert.deepEqual(first, second)
  assert.equal(before.artifacts[0].observedAt, '2026-09-08T10:00:00Z')
})

test('daily capsule is versioned, stable-sorted, and privacy-safe', () => {
  const registry = buildArtifactRegistry([
    artifact({ id: 'z', kind: 'photo', state: 'unknown', uri: 'secret://z' }),
    artifact({ id: 'a', kind: 'file', state: 'stale' }),
    artifact({ id: 'c', kind: 'file', digest: 'sha256:c' }),
    artifact({ id: 'c', kind: 'file', digest: 'sha256:conflict' }),
  ])
  const capsule = createDailyArtifactCapsule({ date: '2026-09-08', registry })
  assert.deepEqual(capsule, {
    version: 1,
    date: '2026-09-08',
    counts: { total: 3, confirmed: 0, unknown: 1, stale: 1, contradicted: 0, inferred: 0, conflict: 1 },
    artifacts: [
      { id: 'a', kind: 'file', state: 'stale' },
      { id: 'c', kind: 'file', state: 'conflict' },
      { id: 'z', kind: 'photo', state: 'unknown' },
    ],
  })
  assert.equal(JSON.stringify(capsule).includes('secret://'), false)
  assert.equal(JSON.stringify(capsule).includes('sha256:'), false)
})

test('daily capsule rejects malformed dates and does not collapse unsafe states', () => {
  assert.throws(() => createDailyArtifactCapsule({ date: 'tomorrow', registry: buildArtifactRegistry([]) }), /ARTIFACT_CAPSULE_DATE_INVALID/)
})
