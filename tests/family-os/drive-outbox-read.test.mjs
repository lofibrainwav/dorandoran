import test from 'node:test'
import assert from 'node:assert/strict'
import { readDriveOutbox } from '../../lib/server/drive-outbox-read.ts'

const base = { lane: '10_JAY', capturedBy: 'test', capturedAt: '2026-09-10T12:00:00Z' }

test('Drive read is explicitly not connected when no runtime credentials exist', async () => {
  assert.deepEqual(await readDriveOutbox({ ...base, env: {} }), { status: 'not_connected', lane: '10_JAY' })
})

test('Drive read refuses partial runtime credentials before any provider call', async () => {
  const result = await readDriveOutbox({ ...base, env: { DRIVE_OUTBOX_CLIENT_ID: 'client' } })
  assert.deepEqual(result, { status: 'incomplete', lane: '10_JAY' })
})
