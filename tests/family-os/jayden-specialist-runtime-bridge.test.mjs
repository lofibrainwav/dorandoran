import test from 'node:test'
import assert from 'node:assert/strict'
import { projectJaydenLearningModule } from '../../lib/server/jayden-specialist-bridge.ts'

test('JDK learning module stays blocked while parent/capsule/same-origin bindings remain', () => {
  const learningModule = projectJaydenLearningModule({
    parentSessionBound: true,
    capsuleBound: true,
    sameOriginBound: true,
    delegatedBridgeConfigured: false,
  })
  assert.equal(learningModule.id, 'learning')
  assert.equal(learningModule.state, 'blocked')
  assert.equal(learningModule.statusLabel, 'Bridge pending')
  assert.deepEqual(learningModule.reasonCodes, [
    'PARENT_SESSION_BOUND',
    'CAPSULE_BOUND',
    'SAME_ORIGIN_BOUND',
    'DELEGATED_BRIDGE_MISSING',
  ])
})

test('JDK learning module becomes ready only with delegated transport and no bindings', () => {
  const learningModule = projectJaydenLearningModule({
    parentSessionBound: false,
    capsuleBound: false,
    sameOriginBound: false,
    delegatedBridgeConfigured: true,
  })
  assert.equal(learningModule.state, 'ready')
  assert.equal(learningModule.statusLabel, 'Connected')
  assert.deepEqual(learningModule.reasonCodes, [])
  const json = JSON.stringify(learningModule)
  assert.equal(json.includes('capsule'), false)
  assert.equal(json.includes('prompt'), false)
  assert.equal(json.includes('evidence'), false)
})
