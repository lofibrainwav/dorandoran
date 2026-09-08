import test from 'node:test'
import assert from 'node:assert/strict'

import nextConfig from '../../next.config.mjs'

function headerMap(entries) {
  return Object.fromEntries(entries.map((h) => [h.key.toLowerCase(), h.value]))
}

test('every route carries clickjacking and MIME-sniffing protection headers', async () => {
  const rules = await nextConfig.headers()
  const global = rules.find((r) => r.source === '/(.*)')
  assert.ok(global, 'expected a catch-all header rule')
  const h = headerMap(global.headers)
  assert.equal(h['x-frame-options'], 'DENY')
  assert.equal(h['x-content-type-options'], 'nosniff')
  assert.match(h['content-security-policy'], /frame-ancestors 'none'/)
  assert.match(h['permissions-policy'], /camera=\(\)/)
})

test('security headers never break Google Identity Services embedding of its own frames', async () => {
  const rules = await nextConfig.headers()
  const h = headerMap(rules.find((r) => r.source === '/(.*)').headers)
  // frame-ancestors only restricts who may embed us; it must not restrict frame-src for GIS.
  assert.doesNotMatch(h['content-security-policy'], /frame-src|script-src/)
})
