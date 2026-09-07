import test from 'node:test'
import assert from 'node:assert/strict'
import {
  adaptJdkVerifiedLearningRelease,
  evaluateJdkReleaseTransport,
} from '../../lib/family-os/index.ts'

test('real JDK verified-release shape becomes a safe Together opportunity', () => {
  const opportunity = adaptJdkVerifiedLearningRelease({
    task: {
      id: 'volume::safe-1', subject: 'math', conceptId: 'math.volume.total',
      context: 'private learning context not needed by Family OS',
      prompt: 'What is the volume?', responseSpec: { kind: 'number' },
      learningNeeds: { cognitive: ['volume'], language: [], representation: ['3d-spatial'] },
      metadata: { length: 4, width: 3, height: 2 },
    },
    plan: { id: 'plan-1', taskId: 'volume::safe-1', adapterId: 'jayden-language-expansion-v0.1', steps: [] },
    rendererId: 'cube-stack',
    verifiedAt: '2026-09-06T20:00:00.000Z',
  }, 'jayden')

  assert.equal(opportunity.mode, 'together')
  assert.equal(opportunity.title, 'What is the volume?')
  assert.equal(opportunity.ownerId, 'jayden')
  assert.equal(opportunity.evidenceRefs.length, 1)
  assert.equal(JSON.stringify(opportunity).includes('private learning context'), false)
  assert.equal(JSON.stringify(opportunity).includes('length'), false)
})

test('invalid JDK verification time fails closed', () => {
  assert.throws(() => adaptJdkVerifiedLearningRelease({
    task: {
      id: 't1', subject: 'reading', conceptId: 'reading.evidence', context: 'x', prompt: 'Question?',
      responseSpec: { kind: 'sentence' }, learningNeeds: { cognitive: [], language: [], representation: [] }, metadata: {},
    },
    plan: { id: 'p1', taskId: 't1', adapterId: 'a1', steps: [] },
    rendererId: 'text-evidence', verifiedAt: 'not-a-date',
  }, 'jayden'), /JDK_RELEASE_VERIFICATION_TIME_INVALID/)
})

test('current parent-bound JDK release endpoint stays blocked for server-to-server bridge', () => {
  assert.deepEqual(evaluateJdkReleaseTransport({
    parentSessionBound: true,
    capsuleBound: true,
    sameOriginBound: true,
    delegatedBridgeConfigured: false,
  }), {
    state: 'blocked_pending_transport',
    reasons: ['PARENT_SESSION_BOUND', 'CAPSULE_BOUND', 'SAME_ORIGIN_BOUND', 'DELEGATED_BRIDGE_MISSING'],
  })
})

test('delegated transport can become ready only when parent-bound requirements are removed from bridge path', () => {
  assert.equal(evaluateJdkReleaseTransport({
    parentSessionBound: false,
    capsuleBound: false,
    sameOriginBound: false,
    delegatedBridgeConfigured: true,
  }).state, 'ready')
})
