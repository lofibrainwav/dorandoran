import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyWorkMode,
  decomposeCalendarEvent,
} from '../../lib/family-os/index.ts'

test('fully executable digital work is DIGITAL', () => {
  assert.equal(classifyWorkMode({
    chadCanExecuteDigital: true,
    requiresPhysicalAction: false,
    requiresHumanDecision: false,
    requiresHumanApproval: false,
  }), 'digital')
})

test('exercise-like human action is PHYSICAL', () => {
  assert.equal(classifyWorkMode({
    chadCanExecuteDigital: false,
    requiresPhysicalAction: true,
    requiresHumanDecision: false,
    requiresHumanApproval: false,
  }), 'physical')
})
test('digital execution plus human approval is TOGETHER', () => {
  assert.equal(classifyWorkMode({
    chadCanExecuteDigital: true,
    requiresPhysicalAction: false,
    requiresHumanDecision: false,
    requiresHumanApproval: true,
  }), 'together')
})

test('explicit child action keeps its declared work mode', () => {
  const blocks = decomposeCalendarEvent({
    id: 'evt-1', title: 'Family task',
    evidence: [{ id: 'e1', sourceType: 'calendar', observedAt: '2026-09-06T12:00:00Z', state: 'confirmed' }],
    explicitActions: [{ id: 'a1', title: 'Bring item', mode: 'physical', physicalOwnerIds: ['person-1'] }],
  })
  const child = blocks.find((block) => block.type === 'action')
  assert.equal(child?.workMode, 'physical')
})