import assert from 'node:assert/strict'
import test from 'node:test'
import { createPostgresDailyCapsuleStore } from '../../lib/server/daily-capsule-store.ts'
import { reconcileAndPersistDailyCapsule } from '../../lib/server/daily-capsule-reconcile.ts'

const capsule = {
  version: 1,
  date: '2026-09-10',
  artifacts: { version: 1, counts: { confirmed: 0, unknown: 0, stale: 0, contradicted: 0, inferred: 0, conflict: 0 }, artifacts: [] },
  captures: { total: 0, byKind: { want: 0, decision: 0, fact: 0, question: 0, final_artifact: 0 } },
  candidates: { total: 0, byState: { proposed: 0, accepted: 0, declined: 0, expired: 0 } },
  tasks: { total: 0, byState: { hold: 0, open: 0, in_progress: 0, risk: 0, done: 0 } },
}

test('daily capsule store upserts one household/date and validates the read shape', async () => {
  const calls = []
  const store = createPostgresDailyCapsuleStore({
    query: async (text, params) => {
      calls.push({ text, params })
      if (text.includes('SELECT capsule')) return { rows: [{ capsule, generated_at: '2026-09-10T23:00:00.000Z' }], rowCount: 1 }
      return { rows: [], rowCount: 1 }
    },
  })
  await store.save({ householdKey: 'family-a', date: capsule.date, capsule, generatedAt: '2026-09-10T23:00:00.000Z' })
  const result = await store.get({ householdKey: 'family-a', date: capsule.date })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].params[0], 'family-a')
  assert.deepEqual(result, { capsule, generatedAt: '2026-09-10T23:00:00.000Z' })
})

test('night reconcile uses household-local previous day and preserves the human gate', async () => {
  const calls = []
  const result = await reconcileAndPersistDailyCapsule({
    householdKey: 'family-a',
    nowIso: '2026-09-11T07:30:00.000Z',
    timeZone: 'America/Los_Angeles',
    query: async (text, params) => {
      calls.push({ text, params })
      if (text.includes('lifecycle_capture')) return { rows: [{ kind: 'want' }], rowCount: 1 }
      if (text.includes('lifecycle_candidate')) return {
        rows: [{ opportunity: { id: 'c1', ownerId: 'jay', title: 'Do it', mode: 'digital', evidenceRefs: [] }, decision: null, created_at: '2026-09-10T20:00:00.000Z' }], rowCount: 1,
      }
      if (text.includes('lifecycle_task')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 1 }
    },
  })
  assert.equal(result.date, '2026-09-10')
  assert.equal(result.captures.total, 1)
  assert.equal(result.candidates.byState.proposed, 1)
  assert.equal(calls.at(-1).params[1], '2026-09-10')
})
