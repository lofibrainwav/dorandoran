import test from 'node:test'
import assert from 'node:assert/strict'

import { requiresExplicitHumanGate, resolveAuthority } from '../../lib/family-os/index.ts'

const now = '2026-09-09T00:15:00.000Z'

function autoGrant(domain, action) {
  return {
    id: `grant:${domain}:${action}`,
    subjectId: 'jay',
    grantee: 'chad',
    domain,
    actions: [action],
    authority: 'auto',
    grantedBy: 'jay',
    evidenceRef: 'ev-consent',
    grantedAt: '2026-09-09T00:00:00.000Z',
  }
}

for (const [domain, action] of [
  ['gmail', 'send'],
  ['files', 'share'],
  ['payments', 'execute'],
  ['publishing', 'publish'],
]) {
  test(`${domain}/${action} cannot become automatic through standing consent`, () => {
    assert.equal(requiresExplicitHumanGate(domain, action), true)
    assert.deepEqual(
      resolveAuthority({
        capable: true,
        subjectId: 'jay',
        domain,
        action,
        nowIso: now,
        grant: autoGrant(domain, action),
      }),
      { state: 'gate_required', reason: 'HUMAN_GATE_REQUIRED' },
    )
  })
}

test('ordinary internal or preparatory actions keep their existing standing-consent semantics', () => {
  for (const [domain, action] of [
    ['gmail', 'draft'],
    ['files', 'write'],
    ['calendar', 'write'],
    ['contacts', 'write'],
  ]) {
    assert.equal(requiresExplicitHumanGate(domain, action), false)
    assert.deepEqual(
      resolveAuthority({
        capable: true,
        subjectId: 'jay',
        domain,
        action,
        nowIso: now,
        grant: autoGrant(domain, action),
      }),
      { state: 'auto', reason: 'AUTHORIZED' },
    )
  }
})

test('blocked consent remains blocked for consequential actions', () => {
  const grant = { ...autoGrant('payments', 'execute'), authority: 'blocked' }
  assert.deepEqual(
    resolveAuthority({
      capable: true,
      subjectId: 'jay',
      domain: 'payments',
      action: 'execute',
      nowIso: now,
      grant,
    }),
    { state: 'blocked', reason: 'CONSENT_BLOCKED' },
  )
})
