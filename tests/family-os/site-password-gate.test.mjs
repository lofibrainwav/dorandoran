import test from 'node:test'
import assert from 'node:assert/strict'
import {
  siteGateToken,
  siteGateAuthorized,
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
