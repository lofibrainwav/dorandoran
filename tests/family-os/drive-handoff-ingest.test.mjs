import test from 'node:test'
import assert from 'node:assert/strict'

import { parseDorandoranHandoff } from '../../lib/family-os/drive-handoff-intake.ts'
import { createMemoryDriveHandoffIngestStore } from '../../lib/server/drive-handoff-ingest.ts'

const context = { capturedBy: 'test', capturedAt: '2026-09-10T05:00:00.000Z' }

function record(overrides = {}) {
  return {
    eventId: 'evt-ingest-1',
    occurredAt: '2026-09-10T04:00:00.000Z',
    person: 'jay',
    domain: 'career',
    kind: 'capture',
    privacyScope: 'personal',
    status: 'candidate',
    sourceSystem: 'chatgpt',
    sourceRefs: ['chat:1'],
    evidenceRefs: ['evidence:1'],
    statedText: 'Review the resume before sending it.',
    unknowns: [],
    candidateSuggested: true,
    requestedAction: 'none',
    ...overrides,
  }
}

test('handoff only carries a candidate proposal when mode is explicit', () => {
  const withoutMode = parseDorandoranHandoff(record(), context)
  assert.equal(withoutMode.ok, true)
  assert.equal(withoutMode.intake.proposeCandidate, true)
  assert.equal(withoutMode.intake.candidateProposal, undefined)

  const withMode = parseDorandoranHandoff(record({ candidateMode: 'together', estimatedMinutes: 30, priority: 'high' }), context)
  assert.equal(withMode.ok, true)
  assert.deepEqual(withMode.intake.candidateProposal, { mode: 'together', estimatedMinutes: 30, priority: 'high' })
})

test('invalid candidate proposal metadata fails closed', () => {
  assert.deepEqual(
    parseDorandoranHandoff(record({ candidateMode: 'guess' }), context),
    { ok: false, code: 'FIELD_INVALID', field: 'candidateMode' },
  )
  assert.deepEqual(
    parseDorandoranHandoff(record({ estimatedMinutes: 30 }), context),
    { ok: false, code: 'FIELD_INVALID', field: 'candidateMode' },
  )
})

test('scheduled handoff ingest is idempotent and never turns into a decision', async () => {
  const parsed = parseDorandoranHandoff(record({ candidateMode: 'digital', estimatedMinutes: 20 }), context)
  assert.equal(parsed.ok, true)
  const store = createMemoryDriveHandoffIngestStore()
  const input = { lane: '10_JAY', fileId: 'file-1', intake: parsed.intake, now: context.capturedAt }
  assert.equal(await store.ingest(input), 'inserted')
  assert.equal(await store.ingest(input), 'duplicate')
})

