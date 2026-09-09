import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isHumanOnlyTask,
  taskToPlannerWish,
  transitionTask,
} from '../../lib/family-os/index.ts'

function task(overrides = {}) {
  return {
    id: 'task-1',
    type: 'action',
    workMode: 'physical',
    reality: { title: 'Ride bikes', durationMinutes: 45 },
    evidenceRefs: ['ev-1'],
    evidenceState: 'unknown',
    people: { subjectIds: ['julie'], physicalOwnerIds: [], approverIds: ['julie'], recipientIds: [] },
    digital: { jobs: [] },
    timeEngine: { protected: false, priority: 'medium' },
    dependencyIds: [],
    childBlockIds: [],
    workState: 'open',
    ...overrides,
  }
}

const now = '2026-09-08T12:00:00.000Z'

test('the allowed task transition graph accepts each documented edge', () => {
  assert.equal(transitionTask(task({ workState: 'open' }), 'in_progress', { nowIso: now }).workState, 'in_progress')
  assert.equal(transitionTask(task({ workState: 'open' }), 'hold', { nowIso: now }).workState, 'hold')
  assert.equal(transitionTask(task({ workState: 'open' }), 'risk', { nowIso: now }).workState, 'risk')
  assert.equal(transitionTask(task({ workState: 'hold' }), 'open', { nowIso: now }).workState, 'open')
  assert.equal(transitionTask(task({ workState: 'in_progress' }), 'risk', { nowIso: now }).workState, 'risk')
  assert.equal(transitionTask(task({ workState: 'in_progress' }), 'hold', { nowIso: now }).workState, 'hold')
  assert.equal(transitionTask(task({ workState: 'risk' }), 'in_progress', { nowIso: now }).workState, 'in_progress')
  assert.equal(transitionTask(task({ workState: 'risk' }), 'hold', { nowIso: now }).workState, 'hold')
  assert.equal(
    transitionTask(task({ workState: 'in_progress' }), 'done', { nowIso: now, readbackEvidenceRefs: ['ev-done'] }).workState,
    'done',
  )
  assert.equal(
    transitionTask(task({ workState: 'risk' }), 'done', { nowIso: now, readbackEvidenceRefs: ['ev-done'] }).workState,
    'done',
  )
})

test('any edge outside the graph is rejected, including from a terminal done state', () => {
  assert.throws(() => transitionTask(task({ workState: 'open' }), 'done', { nowIso: now }), /TASK_TRANSITION_INVALID/)
  assert.throws(() => transitionTask(task({ workState: 'hold' }), 'in_progress', { nowIso: now }), /TASK_TRANSITION_INVALID/)
  assert.throws(() => transitionTask(task({ workState: 'hold' }), 'risk', { nowIso: now }), /TASK_TRANSITION_INVALID/)
  assert.throws(() => transitionTask(task({ workState: 'done' }), 'open', { nowIso: now }), /TASK_TRANSITION_INVALID/)
})

test('chad executing a task must explicitly declare its consequential action before starting work', () => {
  const chadTask = task({ digital: { executor: 'chad', jobs: [] } })
  assert.throws(
    () => transitionTask(chadTask, 'in_progress', { nowIso: now, authority: { state: 'auto', reason: 'AUTHORIZED' } }),
    /CONSEQUENTIAL_DECLARATION_REQUIRED/,
  )
})

test('a human-executed task (no executor) needs no consequential declaration at all', () => {
  const humanTask = task()
  assert.equal(humanTask.digital.executor, undefined)
  assert.equal(transitionTask(humanTask, 'in_progress', { nowIso: now }).workState, 'in_progress')
})

test('chad executing a task requires an explicit auto authority decision before starting work', () => {
  const chadTask = task({ digital: { executor: 'chad', jobs: [] } })
  assert.throws(
    () => transitionTask(chadTask, 'in_progress', { nowIso: now, consequential: null }),
    /AUTHORITY_GATE_REQUIRED/,
  )
  assert.throws(
    () => transitionTask(chadTask, 'in_progress', {
      nowIso: now,
      consequential: null,
      authority: { state: 'gate_required', reason: 'HUMAN_GATE_REQUIRED' },
    }),
    /AUTHORITY_GATE_REQUIRED/,
  )
  assert.equal(
    transitionTask(chadTask, 'in_progress', {
      nowIso: now,
      consequential: null,
      authority: { state: 'auto', reason: 'AUTHORIZED' },
    }).workState,
    'in_progress',
  )
})

test('a consequential action stays gated even when the authority decision claims auto', () => {
  const chadTask = task({ digital: { executor: 'chad', jobs: [] } })
  assert.throws(
    () => transitionTask(chadTask, 'in_progress', {
      nowIso: now,
      authority: { state: 'auto', reason: 'AUTHORIZED' },
      consequential: { domain: 'gmail', action: 'send' },
    }),
    /AUTHORITY_GATE_REQUIRED/,
  )
})

test('an ordinary consequential-free chad action is not affected by the consequential field', () => {
  const chadTask = task({ digital: { executor: 'chad', jobs: [] } })
  const result = transitionTask(chadTask, 'in_progress', {
    nowIso: now,
    authority: { state: 'auto', reason: 'AUTHORIZED' },
    consequential: { domain: 'gmail', action: 'draft' },
  })
  assert.equal(result.workState, 'in_progress')
})

test('closing a task requires readback evidence and records the closure', () => {
  assert.throws(
    () => transitionTask(task({ workState: 'in_progress' }), 'done', { nowIso: now }),
    /READBACK_EVIDENCE_REQUIRED/,
  )
  assert.throws(
    () => transitionTask(task({ workState: 'in_progress' }), 'done', { nowIso: now, readbackEvidenceRefs: [] }),
    /READBACK_EVIDENCE_REQUIRED/,
  )
  const done = transitionTask(task({ workState: 'in_progress' }), 'done', { nowIso: now, readbackEvidenceRefs: ['ev-done'] })
  assert.deepEqual(done.closure, { executedAt: now, readbackEvidenceRefs: ['ev-done'] })
})

test('human_only is a digital executor left unset plus a real-world physical owner', () => {
  assert.equal(isHumanOnlyTask(task({ people: { subjectIds: ['julie'], physicalOwnerIds: ['julie'], approverIds: [], recipientIds: [] } })), true)
  assert.equal(isHumanOnlyTask(task({ people: { subjectIds: ['julie'], physicalOwnerIds: [], approverIds: [], recipientIds: [] } })), false)
  assert.equal(
    isHumanOnlyTask(task({
      digital: { executor: 'chad', jobs: [] },
      people: { subjectIds: ['julie'], physicalOwnerIds: ['julie'], approverIds: [], recipientIds: [] },
    })),
    false,
  )
})

test('taskToPlannerWish maps a schedulable task and returns null for the rest', () => {
  const wish = taskToPlannerWish(task({ timeEngine: { protected: false, priority: 'high' } }))
  assert.deepEqual(wish, { id: 'task-1', title: 'Ride bikes', minutes: 45, estimated: true, required: true, owner: 'julie' })

  assert.equal(taskToPlannerWish(task({ reality: { title: 'Ride bikes' } })), null)
  assert.equal(taskToPlannerWish(task({ workState: 'done' })), null)
})

test('taskToPlannerWish never emits an undefined owner: an ownerless task maps to null', () => {
  const ownerless = task({ people: { subjectIds: [], physicalOwnerIds: [], approverIds: [], recipientIds: [] } })
  assert.equal(taskToPlannerWish(ownerless), null)
})
