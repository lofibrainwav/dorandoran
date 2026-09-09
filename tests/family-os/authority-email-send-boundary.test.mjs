import test from 'node:test'
import assert from 'node:assert/strict'

import { requiresExplicitHumanGate, resolveAuthority } from '../../lib/family-os/index.ts'

const now = '2026-09-08T23:50:00.000Z'

function grant(overrides = {}) {
  return {
    id: 'grant-send',
    subjectId: 'jay',
    grantee: 'chad',
    domain: 'gmail',
    actions: ['send'],
    authority: 'auto',
    grantedBy: 'jay',
    evidenceRef: 'ev-human-consent',
    grantedAt: '2026-09-08T23:00:00.000Z',
    ...overrides,
  }
}

test('gmail send is a permanent per-action human gate even when a standing grant says auto', () => {
  assert.equal(requiresExplicitHumanGate('gmail', 'send'), true)
  assert.deepEqual(
    resolveAuthority({
      capable: true,
      subjectId: 'jay',
      domain: 'gmail',
      action: 'send',
      nowIso: now,
      grant: grant(),
    }),
    { state: 'gate_required', reason: 'HUMAN_GATE_REQUIRED' },
  )
})

test('blocked consent remains blocked and is never softened into a human gate', () => {
  assert.deepEqual(
    resolveAuthority({
      capable: true,
      subjectId: 'jay',
      domain: 'gmail',
      action: 'send',
      nowIso: now,
      grant: grant({ authority: 'blocked' }),
    }),
    { state: 'blocked', reason: 'CONSENT_BLOCKED' },
  )
})

test('missing, mismatched, revoked, expired, or action-less consent still fails before the hard gate', () => {
  assert.equal(
    resolveAuthority({ capable: true, subjectId: 'jay', domain: 'gmail', action: 'send', nowIso: now }).reason,
    'CONSENT_GRANT_MISSING',
  )
  assert.equal(
    resolveAuthority({ capable: true, subjectId: 'jay', domain: 'gmail', action: 'send', nowIso: now, grant: grant({ subjectId: 'julie' }) }).reason,
    'CONSENT_SCOPE_MISMATCH',
  )
  assert.equal(
    resolveAuthority({ capable: true, subjectId: 'jay', domain: 'gmail', action: 'send', nowIso: now, grant: grant({ revokedAt: now }) }).reason,
    'CONSENT_REVOKED',
  )
  assert.equal(
    resolveAuthority({ capable: true, subjectId: 'jay', domain: 'gmail', action: 'send', nowIso: now, grant: grant({ expiresAt: now }) }).reason,
    'CONSENT_EXPIRED',
  )
  assert.equal(
    resolveAuthority({ capable: true, subjectId: 'jay', domain: 'gmail', action: 'send', nowIso: now, grant: grant({ actions: ['read'] }) }).reason,
    'ACTION_NOT_GRANTED',
  )
})

test('gmail draft is not silently promoted to the email-send authority boundary', () => {
  assert.equal(requiresExplicitHumanGate('gmail', 'draft'), false)
  assert.deepEqual(
    resolveAuthority({
      capable: true,
      subjectId: 'jay',
      domain: 'gmail',
      action: 'draft',
      nowIso: now,
      grant: grant({ actions: ['draft'] }),
    }),
    { state: 'auto', reason: 'AUTHORIZED' },
  )
})
