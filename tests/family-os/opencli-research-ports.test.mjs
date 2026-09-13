import test from 'node:test'
import assert from 'node:assert/strict'
import { openCliWebReadArgs, readOpenCliWeb } from '../../lib/server/opencli-research-ports.ts'

test('OpenCLI web read builds read-only arguments and returns a safe observation', async () => {
  let received
  const result = await readOpenCliWeb({
    url: 'https://example.com/research', observedAt: '2026-09-12T20:00:00Z',
    runner: async (args) => { received = args; return { stdout: 'A useful page summary with a source-backed fact.' } },
  })
  assert.deepEqual(received, ['web', 'read', '--url', 'https://example.com/research', '--stdout'])
  assert.equal(result.state, 'ready')
  assert.equal(result.observation.contentKind, 'web')
  assert.equal(result.observation.evidenceState, 'confirmed')
  assert.equal(result.observation.sourceUrl, 'https://example.com/research')
  assert.equal(JSON.stringify(result).includes('cookie'), false)
})

test('empty OpenCLI output stays empty rather than becoming a confirmed observation', async () => {
  const result = await readOpenCliWeb({ url: 'https://example.com/empty', observedAt: '2026-09-12T20:00:00Z', runner: async () => ({ stdout: ' \n ' }) })
  assert.deepEqual(result, { state: 'empty' })
})

test('timeout and bridge failures stay unavailable', async () => {
  const timeout = await readOpenCliWeb({ url: 'https://example.com/timeout', observedAt: '2026-09-12T20:00:00Z', runner: async () => { throw Object.assign(new Error('command timeout'), { code: 'ETIMEDOUT' }) } })
  const bridge = await readOpenCliWeb({ url: 'https://example.com/bridge', observedAt: '2026-09-12T20:00:00Z', runner: async () => { throw new Error('Browser Bridge daemon unavailable') } })
  assert.deepEqual(timeout, { state: 'unavailable', reason: 'timeout' })
  assert.deepEqual(bridge, { state: 'unavailable', reason: 'bridge_unavailable' })
})

test('invalid or non-web URLs are rejected before OpenCLI runs', () => {
  assert.throws(() => openCliWebReadArgs('file:///private/secret'), /OPENCLI_RESEARCH_URL_INVALID/)
  assert.throws(() => openCliWebReadArgs('not-a-url'), /OPENCLI_RESEARCH_URL_INVALID/)
})
