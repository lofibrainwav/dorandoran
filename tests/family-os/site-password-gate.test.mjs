import test from 'node:test'
import assert from 'node:assert/strict'
import {
  siteGateToken,
  siteGateAuthorized,
  siteGateSessionToken,
  siteGateSessionAuthorized,
  safeNextPath,
  siteGateConfig,
} from '../../lib/server/site-password-gate.ts'

test('gate token is deterministic and never contains the raw password', async () => {
  const token = await siteGateToken('test-code', 'fixture-key-a')
  assert.equal(token, await siteGateToken('test-code', 'fixture-key-a'))
  assert.notEqual(token, await siteGateToken('test-code', 'fixture-key-b'))
  assert.equal(token.includes('test-code'), false)
  assert.match(token, /^[A-Za-z0-9_-]{40,}$/)
})

test('authorization requires the exact derived cookie token', async () => {
  const expected = await siteGateToken('test-code', 'fixture-key-a')
  assert.equal(await siteGateAuthorized(expected, 'test-code', 'fixture-key-a'), true)
  assert.equal(await siteGateAuthorized('wrong', 'test-code', 'fixture-key-a'), false)
  assert.equal(await siteGateAuthorized(undefined, 'test-code', 'fixture-key-a'), false)
})

test('signed fallback session survives without a cookie until expiry', async () => {
  const now = Date.UTC(2026, 8, 8, 4, 0, 0)
  const token = await siteGateSessionToken('fixture-key-a', now + 60_000)
  assert.equal(await siteGateSessionAuthorized(token, 'fixture-key-a', now), true)
  assert.equal(await siteGateSessionAuthorized(token, 'fixture-key-a', now + 59_000), true)
  assert.equal(await siteGateSessionAuthorized(token, 'fixture-key-a', now + 60_000), false)
})

test('signed fallback session rejects tampering and wrong gate keys', async () => {
  const now = Date.UTC(2026, 8, 8, 4, 0, 0)
  const token = await siteGateSessionToken('fixture-key-a', now + 60_000)
  assert.equal(await siteGateSessionAuthorized(`${token}x`, 'fixture-key-a', now), false)
  assert.equal(await siteGateSessionAuthorized(token, 'fixture-key-b', now), false)
  assert.equal(await siteGateSessionAuthorized('bad', 'fixture-key-a', now), false)
})

test('next path accepts only same-site absolute paths', () => {
  assert.equal(safeNextPath('/family?view=past'), '/family?view=past')
  assert.equal(safeNextPath('/'), '/')
  assert.equal(safeNextPath('https://evil.example/'), '/')
  assert.equal(safeNextPath('//evil.example/'), '/')
  assert.equal(safeNextPath('family'), '/')
})

test('gate config fails closed when either environment secret is missing', () => {
  assert.deepEqual(siteGateConfig({}), { enabled: false, accessCode: null, gateKey: null })
  assert.deepEqual(siteGateConfig({ DORANDORAN_ACCESS_CODE: 'test-code' }), { enabled: false, accessCode: null, gateKey: null })
  assert.deepEqual(siteGateConfig({ DORANDORAN_ACCESS_CODE: 'test-code', DORANDORAN_GATE_KEY: 'fixture-key' }), {
    enabled: true, accessCode: 'test-code', gateKey: 'fixture-key',
  })
})
