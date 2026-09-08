import test from 'node:test'
import assert from 'node:assert/strict'

import {
  loadJdkApprovedReleases,
  parseJdkApprovedReleasesPayload,
  projectLearningModuleWithApprovedReleases,
  releasesUrlFromStatusUrl,
} from '../../lib/server/jdk-approved-releases.ts'

const release = {
  releaseId: 'release-1',
  taskId: 'task-1',
  subject: 'math',
  conceptId: 'volume',
  rendererId: 'practice-card',
  approvedAt: '2026-09-08T21:00:00.000Z',
}

test('release URL is derived from the already-validated delegated bridge status URL', () => {
  assert.equal(
    releasesUrlFromStatusUrl('https://jdk.example/api/family-bridge/status'),
    'https://jdk.example/api/family-bridge/releases',
  )
})

test('approved-release payload accepts only the privacy-minimized projection contract', () => {
  assert.deepEqual(parseJdkApprovedReleasesPayload({ ok: true, releases: [release] }), [release])
  assert.throws(() => parseJdkApprovedReleasesPayload({ ok: true, releases: [{ ...release, approvedAt: 'not-a-date' }] }), /JDK_RELEASES_INVALID/)
  assert.throws(() => parseJdkApprovedReleasesPayload({ ok: true, releases: [{ ...release, subject: '' }] }), /JDK_RELEASES_INVALID/)
  assert.throws(() => parseJdkApprovedReleasesPayload({ ok: false, releases: [] }), /JDK_RELEASES_INVALID/)
  assert.throws(() => parseJdkApprovedReleasesPayload(null), /JDK_RELEASES_INVALID/)
})

test('configured bridge reads releases with the bearer token but never returns the token or bridge URL', async () => {
  const env = {
    DORANDORAN_JDK_BRIDGE_URL: 'https://jdk.example/api/family-bridge',
    DORANDORAN_JDK_BRIDGE_TOKEN: 'super-secret-token',
  }
  let calls = 0
  const result = await loadJdkApprovedReleases({
    env,
    cacheTtlMs: 0,
    fetchReleases: async (url, token) => {
      calls += 1
      assert.equal(url, 'https://jdk.example/api/family-bridge/releases')
      assert.equal(token, 'super-secret-token')
      return { status: 200, body: JSON.stringify({ ok: true, releases: [release] }) }
    },
  })
  assert.equal(calls, 1)
  assert.equal(result.probe, 'ok')
  assert.equal(result.releases.length, 1)
  const serialized = JSON.stringify(result)
  assert.equal(serialized.includes('super-secret-token'), false)
  assert.equal(serialized.includes('jdk.example'), false)
})

test('release readback fails closed for missing config, auth failure, network failure and invalid payloads', async () => {
  assert.deepEqual(await loadJdkApprovedReleases({ env: {} }), { probe: 'not_configured', releases: [] })
  const env = { DORANDORAN_JDK_BRIDGE_URL: 'https://jdk.example/api/family-bridge' }
  const unauthorized = await loadJdkApprovedReleases({ env, cacheTtlMs: 0, fetchReleases: async () => ({ status: 401, body: '' }) })
  assert.equal(unauthorized.probe, 'unauthorized')
  const unavailable = await loadJdkApprovedReleases({ env, cacheTtlMs: 0, fetchReleases: async () => ({ status: 503, body: '' }) })
  assert.equal(unavailable.probe, 'unreachable')
  const malformed = await loadJdkApprovedReleases({ env, cacheTtlMs: 0, fetchReleases: async () => ({ status: 200, body: '<html>oops</html>' }) })
  assert.equal(malformed.probe, 'invalid')
  const oversized = await loadJdkApprovedReleases({ env, cacheTtlMs: 0, fetchReleases: async () => ({ status: 200, body: JSON.stringify({ ok: true, releases: [], pad: 'x'.repeat(40000) }) }) })
  assert.equal(oversized.probe, 'invalid')
})

test('Learning is only Connected when both status and approved-release readback are healthy', () => {
  const connected = { id: 'learning', label: 'Learning', state: 'ready', statusLabel: 'Connected', reasonCodes: [] }
  const healthy = projectLearningModuleWithApprovedReleases(connected, { probe: 'ok', releases: [release, { ...release, releaseId: 'release-2' }] })
  assert.equal(healthy.state, 'ready')
  assert.equal(healthy.statusLabel, 'Connected · 승인 릴리즈 2개')

  const denied = projectLearningModuleWithApprovedReleases(connected, { probe: 'unauthorized', releases: [] })
  assert.equal(denied.state, 'unknown')
  assert.equal(denied.statusLabel, 'Bridge unauthorized')
  assert.deepEqual(denied.reasonCodes, ['DELEGATED_RELEASES_UNAUTHORIZED'])

  const pending = { id: 'learning', label: 'Learning', state: 'blocked', statusLabel: 'Bridge pending', reasonCodes: ['PARENT_SESSION_BOUND'] }
  assert.deepEqual(
    projectLearningModuleWithApprovedReleases(pending, { probe: 'ok', releases: [release] }),
    pending,
  )
})
