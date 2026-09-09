import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseCaptureBody,
  parseDecideBody,
  parseLimitParam,
  parseTransitionBody,
  parseWorkStatesParam,
} from '../../lib/server/lifecycle-request.ts'

function validCapture(overrides = {}) {
  return {
    privacyScope: 'family',
    kind: 'want',
    statedText: 'ride bikes',
    source: 'human',
    ...overrides,
  }
}

function validDecide(overrides = {}) {
  return { personId: 'julie', kind: 'accept', expectedVersion: 1, ...overrides }
}

function validTransition(overrides = {}) {
  return { personId: 'julie', next: 'in_progress', expectedVersion: 1, ...overrides }
}

// ---- parseCaptureBody ----

test('parseCaptureBody accepts a minimal valid body', () => {
  assert.ok(parseCaptureBody(validCapture()))
})

test('parseCaptureBody rejects an empty statedText', () => {
  assert.equal(parseCaptureBody(validCapture({ statedText: '' })), null)
})

test('parseCaptureBody rejects a statedText over 2000 characters', () => {
  assert.equal(parseCaptureBody(validCapture({ statedText: 'x'.repeat(2001) })), null)
  assert.ok(parseCaptureBody(validCapture({ statedText: 'x'.repeat(2000) })))
})

test('parseCaptureBody rejects a non-string statedText', () => {
  assert.equal(parseCaptureBody(validCapture({ statedText: 12345 })), null)
})

test('parseCaptureBody accepts a well-formed occurredAt and rejects garbage or overlong ones', () => {
  assert.ok(parseCaptureBody(validCapture({ occurredAt: '2026-09-08T10:00:00.000Z' })))
  assert.equal(parseCaptureBody(validCapture({ occurredAt: 'not a date' })), null)
  assert.equal(parseCaptureBody(validCapture({ occurredAt: `2026-09-08T10:00:00.000Z${'0'.repeat(40)}` })), null)
})

test('parseCaptureBody rejects an occurredAt one character over the 40-character length bound', () => {
  const over40 = `${'2'.repeat(41)}`
  assert.equal(over40.length, 41)
  assert.equal(parseCaptureBody(validCapture({ occurredAt: over40 })), null)
})

test('parseCaptureBody bounds evidenceRefs and unknowns: item length 1..200, list length <= 50', () => {
  assert.ok(parseCaptureBody(validCapture({ evidenceRefs: ['ev-1'] })))
  assert.equal(parseCaptureBody(validCapture({ evidenceRefs: [''] })), null)
  assert.equal(parseCaptureBody(validCapture({ evidenceRefs: ['x'.repeat(201)] })), null)
  assert.ok(parseCaptureBody(validCapture({ evidenceRefs: ['x'.repeat(200)] })))
  assert.equal(parseCaptureBody(validCapture({ evidenceRefs: Array.from({ length: 51 }, (_, i) => `ev-${i}`) })), null)
  assert.ok(parseCaptureBody(validCapture({ evidenceRefs: Array.from({ length: 50 }, (_, i) => `ev-${i}`) })))

  assert.equal(parseCaptureBody(validCapture({ unknowns: [''] })), null)
  assert.equal(parseCaptureBody(validCapture({ unknowns: Array.from({ length: 51 }, (_, i) => `u-${i}`) })), null)
})

test('parseCaptureBody bounds propose.estimatedMinutes to a finite integer 0..1440', () => {
  assert.ok(parseCaptureBody(validCapture({ propose: { mode: 'physical', estimatedMinutes: 0 } })))
  assert.ok(parseCaptureBody(validCapture({ propose: { mode: 'physical', estimatedMinutes: 1440 } })))
  assert.equal(parseCaptureBody(validCapture({ propose: { mode: 'physical', estimatedMinutes: 1441 } })), null)
  assert.equal(parseCaptureBody(validCapture({ propose: { mode: 'physical', estimatedMinutes: -1 } })), null)
  assert.equal(parseCaptureBody(validCapture({ propose: { mode: 'physical', estimatedMinutes: 1.5 } })), null)
  assert.equal(parseCaptureBody(validCapture({ propose: { mode: 'physical', estimatedMinutes: Number.NaN } })), null)
})

// ---- parseDecideBody ----

test('parseDecideBody accepts a minimal valid body', () => {
  assert.ok(parseDecideBody(validDecide()))
})

test('parseDecideBody bounds expectedVersion to a positive integer <= 1e9', () => {
  assert.ok(parseDecideBody(validDecide({ expectedVersion: 1 })))
  assert.ok(parseDecideBody(validDecide({ expectedVersion: 1_000_000_000 })))
  assert.equal(parseDecideBody(validDecide({ expectedVersion: 0 })), null)
  assert.equal(parseDecideBody(validDecide({ expectedVersion: -1 })), null)
  assert.equal(parseDecideBody(validDecide({ expectedVersion: 1_000_000_001 })), null)
  assert.equal(parseDecideBody(validDecide({ expectedVersion: 1.5 })), null)
})

// ---- parseTransitionBody ----

test('parseTransitionBody accepts a minimal valid body', () => {
  assert.ok(parseTransitionBody(validTransition()))
})

test('parseTransitionBody bounds readbackEvidenceRefs the same as capture evidence lists', () => {
  assert.ok(parseTransitionBody(validTransition({ readbackEvidenceRefs: ['ev-done'] })))
  assert.equal(parseTransitionBody(validTransition({ readbackEvidenceRefs: [''] })), null)
  assert.equal(parseTransitionBody(validTransition({ readbackEvidenceRefs: ['x'.repeat(201)] })), null)
  assert.equal(
    parseTransitionBody(validTransition({ readbackEvidenceRefs: Array.from({ length: 51 }, (_, i) => `ev-${i}`) })),
    null,
  )
})

test('parseTransitionBody bounds expectedVersion to a positive integer <= 1e9', () => {
  assert.equal(parseTransitionBody(validTransition({ expectedVersion: 0 })), null)
  assert.equal(parseTransitionBody(validTransition({ expectedVersion: 1_000_000_001 })), null)
})

// ---- query param parsers ----

test('parseLimitParam returns undefined when absent and a bare number otherwise', () => {
  assert.equal(parseLimitParam(null), undefined)
  assert.equal(parseLimitParam('10'), 10)
  assert.ok(Number.isNaN(parseLimitParam('not-a-number')))
})

test('parseWorkStatesParam: undefined when absent, null when invalid, a list when valid', () => {
  assert.equal(parseWorkStatesParam(null), undefined)
  assert.equal(parseWorkStatesParam(''), null)
  assert.equal(parseWorkStatesParam('not-a-state'), null)
  assert.deepEqual(parseWorkStatesParam('open,done'), ['open', 'done'])
})
