import test from 'node:test'
import assert from 'node:assert/strict'

import {
  loadJaydenLearningModule,
  parseJdkBridgeStatus,
  resolveJdkBridgeConfig,
  resolveJdkReleaseTransport,
} from '../../lib/server/jdk-bridge-transport.ts'

test('bridge config requires an https URL and never leaks the token into the config shape used for logs', () => {
  assert.equal(resolveJdkBridgeConfig({}), null)
  assert.equal(resolveJdkBridgeConfig({ DORANDORAN_JDK_BRIDGE_URL: '  ' }), null)
  assert.throws(() => resolveJdkBridgeConfig({ DORANDORAN_JDK_BRIDGE_URL: 'http://jdk.local/bridge' }), /JDK_BRIDGE_URL_INVALID/)
  const config = resolveJdkBridgeConfig({ DORANDORAN_JDK_BRIDGE_URL: 'https://jdk.example/bridge/', DORANDORAN_JDK_BRIDGE_TOKEN: 'secret-token' })
  assert.equal(config.statusUrl, 'https://jdk.example/bridge/status')
  assert.equal(config.hasToken, true)
})

test('bridge status payload must state every binding explicitly; nothing is assumed open', () => {
  assert.deepEqual(parseJdkBridgeStatus({ parentSessionBound: false, capsuleBound: false, sameOriginBound: false }), {
    parentSessionBound: false, capsuleBound: false, sameOriginBound: false,
  })
  assert.throws(() => parseJdkBridgeStatus({ parentSessionBound: false, capsuleBound: false }), /JDK_BRIDGE_STATUS_INVALID/)
  assert.throws(() => parseJdkBridgeStatus({ parentSessionBound: 'no', capsuleBound: false, sameOriginBound: false }), /JDK_BRIDGE_STATUS_INVALID/)
  assert.throws(() => parseJdkBridgeStatus(null), /JDK_BRIDGE_STATUS_INVALID/)
})

const ok = (obj) => async () => ({ status: 200, body: JSON.stringify(obj) })
const noCache = { cacheTtlMs: 0 }

test('no bridge configured → blocked with only the reason we actually know', async () => {
  const resolution = await resolveJdkReleaseTransport({ env: {} })
  assert.equal(resolution.probe, 'not_configured')
  assert.equal(resolution.decision.state, 'blocked_pending_transport')
  assert.deepEqual(resolution.decision.reasons, ['DELEGATED_BRIDGE_MISSING'])
})

test('configured bridge that reports open bindings → ready; bound bindings → blocked with the reported reasons', async () => {
  const env = { DORANDORAN_JDK_BRIDGE_URL: 'https://jdk.example/bridge' }
  const ready = await resolveJdkReleaseTransport({
    env, ...noCache,
    fetchStatus: ok({ parentSessionBound: false, capsuleBound: false, sameOriginBound: false }),
  })
  assert.equal(ready.probe, 'ok')
  assert.equal(ready.decision.state, 'ready')

  const bound = await resolveJdkReleaseTransport({
    env, ...noCache,
    fetchStatus: ok({ parentSessionBound: true, capsuleBound: false, sameOriginBound: true }),
  })
  assert.equal(bound.decision.state, 'blocked_pending_transport')
  assert.deepEqual(bound.decision.reasons, ['PARENT_SESSION_BOUND', 'SAME_ORIGIN_BOUND'])
})

test('unreachable or malformed bridge fails closed as unknown, never as connected', async () => {
  const env = { DORANDORAN_JDK_BRIDGE_URL: 'https://jdk.example/bridge' }
  const down = await resolveJdkReleaseTransport({ env, ...noCache, fetchStatus: async () => { throw new Error('ECONNREFUSED') } })
  assert.equal(down.probe, 'unreachable')
  assert.equal(down.decision.state, 'blocked_pending_transport')
  assert.deepEqual(down.decision.reasons, ['DELEGATED_BRIDGE_UNREACHABLE'])

  const http500 = await resolveJdkReleaseTransport({ env, ...noCache, fetchStatus: async () => ({ status: 500, body: '' }) })
  assert.equal(http500.probe, 'unreachable')

  const bad = await resolveJdkReleaseTransport({ env, ...noCache, fetchStatus: ok({ nope: true }) })
  assert.equal(bad.probe, 'invalid')
  assert.deepEqual(bad.decision.reasons, ['DELEGATED_BRIDGE_STATUS_INVALID'])

  const notJson = await resolveJdkReleaseTransport({ env, ...noCache, fetchStatus: async () => ({ status: 200, body: '<html>maintenance</html>' }) })
  assert.equal(notJson.probe, 'invalid')

  const huge = await resolveJdkReleaseTransport({ env, ...noCache, fetchStatus: async () => ({ status: 200, body: JSON.stringify({ parentSessionBound: false, capsuleBound: false, sameOriginBound: false, pad: 'x'.repeat(5000) }) }) })
  assert.equal(huge.probe, 'invalid')
})

test('401/403 from the bridge is reported as unauthorized, distinct from a network failure', async () => {
  const env = { DORANDORAN_JDK_BRIDGE_URL: 'https://jdk.example/bridge', DORANDORAN_JDK_BRIDGE_TOKEN: 'stale' }
  const denied = await resolveJdkReleaseTransport({ env, ...noCache, fetchStatus: async () => ({ status: 403, body: '' }) })
  assert.equal(denied.probe, 'unauthorized')
  assert.deepEqual(denied.decision.reasons, ['DELEGATED_BRIDGE_UNAUTHORIZED'])
  const m = await loadJaydenLearningModule({ env, ...noCache, fetchStatus: async () => ({ status: 401, body: '' }) })
  assert.equal(m.state, 'unknown')
  assert.equal(m.statusLabel, 'Bridge unauthorized')
})

test('probe results are cached for a short TTL so a slow bridge is not paid on every render', async () => {
  const env = { DORANDORAN_JDK_BRIDGE_URL: 'https://jdk.example/cache-test' }
  let calls = 0
  const fetchStatus = async () => { calls += 1; return { status: 200, body: JSON.stringify({ parentSessionBound: false, capsuleBound: false, sameOriginBound: false }) } }
  await resolveJdkReleaseTransport({ env, fetchStatus, now: 1_000, cacheTtlMs: 20_000 })
  await resolveJdkReleaseTransport({ env, fetchStatus, now: 5_000, cacheTtlMs: 20_000 })
  assert.equal(calls, 1)
  await resolveJdkReleaseTransport({ env, fetchStatus, now: 30_000, cacheTtlMs: 20_000 })
  assert.equal(calls, 2)
})

test('learning module projection is data-driven and secret-free across every probe outcome', async () => {
  const env = { DORANDORAN_JDK_BRIDGE_URL: 'https://jdk.example/bridge', DORANDORAN_JDK_BRIDGE_TOKEN: 'secret-token' }
  const pending = await loadJaydenLearningModule({ env: {} })
  assert.equal(pending.state, 'blocked')
  assert.equal(pending.statusLabel, 'Bridge pending')

  const connected = await loadJaydenLearningModule({ env, ...noCache, fetchStatus: ok({ parentSessionBound: false, capsuleBound: false, sameOriginBound: false }) })
  assert.equal(connected.state, 'ready')
  assert.equal(connected.statusLabel, 'Connected')

  const unreachable = await loadJaydenLearningModule({ env, ...noCache, fetchStatus: async () => { throw new Error('timeout') } })
  assert.equal(unreachable.state, 'unknown')
  assert.equal(unreachable.statusLabel, 'Bridge unreachable')

  for (const m of [pending, connected, unreachable]) {
    const json = JSON.stringify(m)
    assert.equal(json.includes('secret-token'), false)
    assert.equal(json.includes('jdk.example'), false)
  }
})
