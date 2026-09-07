import test from 'node:test'
import assert from 'node:assert/strict'
import { projectOperatingHandoff, projectOperatingWatch } from '../../lib/family-os/index.ts'

function insight(state) {
  return {
    eventId: 'event-1', targetEventId: 'calendar:source:event-1', title: 'Private event title',
    protected: true, state, nextStep: state === 'confirmed' ? 'none' : 'prepare',
    needsHumanAttention: false, changeKinds: state === 'changed' ? ['start'] : [],
    hints: state === 'changed' ? ['review_transition'] : [], reality: {}, evidenceRefs: ['evidence-1'],
  }
}

test('confirmed week insight stays quiet in Today/Now WATCH', () => {
  assert.equal(projectOperatingWatch(insight('confirmed')), null)
})

test('changed insight becomes a privacy-safe WATCH projection', () => {
  const watch = projectOperatingWatch(insight('changed'))
  assert.deepEqual(watch, {
    state: 'changed', label: 'Updated', tone: 'info',
    hints: ['review_transition'], evidenceRefs: ['evidence-1'],
  })
  assert.equal(JSON.stringify(watch).includes('Private event title'), false)
})

test('handoff projection exposes state and modes without raw description', () => {
  const handoff = projectOperatingHandoff({
    id: 'handoff-1', goalId: 'goal-1', fromMode: 'digital', toMode: 'physical',
    description: 'Private pickup detail', state: 'pending', evidenceRefs: [],
  })
  assert.deepEqual(handoff, {
    id: 'handoff-1', state: 'pending', fromMode: 'digital', toMode: 'physical', evidenceRefs: [],
  })
  assert.equal(JSON.stringify(handoff).includes('Private pickup detail'), false)
})
