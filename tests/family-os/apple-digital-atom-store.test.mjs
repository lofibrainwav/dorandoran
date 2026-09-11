import test from 'node:test'
import assert from 'node:assert/strict'
import { createPostgresAppleDigitalAtomStore } from '../../lib/server/apple-digital-atom-store.ts'

function batch() {
  return {
    protocolVersion: 1, deviceId: 'iphone-1', source: 'calendar', cursor: 'cursor-1', sentAt: '2026-09-10T19:00:00Z',
    events: [{ eventId: 'event-1', operation: 'upsert', kind: 'schedule', occurredAt: '2026-09-10T18:00:00Z', metadata: { title: 'Swimming' } }],
  }
}

test('ingest writes receipt, metadata, and cursor in one transaction', async () => {
  const calls = []
  const store = createPostgresAppleDigitalAtomStore({
    transaction: async (run) => run(async (text, params) => {
      calls.push({ text, params })
      if (text.includes('INSERT INTO apple_digital_atom_receipt')) return { rows: [{}], rowCount: 1 }
      return { rows: [], rowCount: 1 }
    }),
  })
  const result = await store.ingest(batch())
  assert.equal(result.status, 'accepted')
  assert.equal(calls.length, 3)
  assert.match(calls[1].text, /apple_digital_atom_metadata/)
  assert.equal(calls[1].params[6], '{"title":"Swimming"}')
})

test('duplicate receipt does not write metadata or advance cursor', async () => {
  let calls = 0
  const store = createPostgresAppleDigitalAtomStore({
    transaction: async (run) => run(async () => { calls += 1; return { rows: [], rowCount: 0 } }),
  })
  const result = await store.ingest(batch())
  assert.equal(result.status, 'duplicate')
  assert.equal(calls, 1)
})

test('invalid or raw atom payload is refused before the transaction', async () => {
  let transactions = 0
  const store = createPostgresAppleDigitalAtomStore({ transaction: async () => { transactions += 1; throw new Error('must not run') } })
  await assert.rejects(() => store.ingest({ ...batch(), events: [{ ...batch().events[0], metadata: { notes: 'raw' } }] }), /APPLE_DIGITAL_ATOM_BATCH_INVALID/)
  assert.equal(transactions, 0)
})
