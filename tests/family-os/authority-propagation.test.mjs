import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import {
  canonicalAuthorityScope,
  grantAuthorityFromAcceptedCandidate,
  evaluateAuthority,
} from '../../lib/family-os/authority-propagation.ts'

// 해시는 주입된다 — lib/family-os 는 node: 모듈을 import 하지 않는 브라우저 안전 계층이다.
const digest = (canonical) => `sha256:${createHash('sha256').update(canonical).digest('hex')}`

function candidate(overrides = {}) {
  return {
    id: 'cand-1',
    ownerId: 'jay',
    title: 'send the release note',
    mode: 'digital',
    evidenceRefs: ['capture-1'],
    decision: { by: 'jay', at: '2026-09-09T10:00:00.000Z', kind: 'accept', evidenceRef: 'decision-1' },
    ...overrides,
  }
}

const SCOPE = { action: 'publish_release_note', resources: ['drive:file-b', 'drive:file-a'] }

function grant(overrides = {}) {
  return grantAuthorityFromAcceptedCandidate({
    candidate: candidate(),
    taskId: 'task-1',
    scope: SCOPE,
    expiresAt: '2026-09-09T22:00:00.000Z',
    nonce: 'nonce-1',
    digest,
    ...overrides,
  })
}

// ---- canonical scope ----

test('scope canonicalization sorts and dedups so caller order cannot change the digest', () => {
  const a = canonicalAuthorityScope({ action: 'x', resources: ['b', 'a', 'b'] })
  const b = canonicalAuthorityScope({ action: 'x', resources: ['a', 'b'] })
  assert.equal(a, b)
  assert.equal(a, 'x\na\nb')
})

// ---- grant ----

test('a grant copies the human decision and never authors it', () => {
  const result = grant()
  assert.equal(result.grantedBy, 'jay')
  assert.equal(result.grantedAt, '2026-09-09T10:00:00.000Z')
  assert.equal(result.evidenceRef, 'decision-1')
  assert.equal(result.taskId, 'task-1')
  assert.equal(result.candidateId, 'cand-1')
  assert.equal(result.scopeDigest, digest('publish_release_note\ndrive:file-a\ndrive:file-b'))
})

test('an undecided or declined candidate cannot mint authority', () => {
  for (const decision of [undefined, { by: 'jay', at: '2026-09-09T10:00:00.000Z', kind: 'decline', evidenceRef: 'd' }]) {
    assert.throws(
      () => grant({ candidate: candidate({ decision }) }),
      /CANDIDATE_NOT_ACCEPTED/,
    )
  }
})

test('a grant without an end is refused — standing permission is not a decision', () => {
  assert.throws(() => grant({ expiresAt: '' }), /AUTHORITY_EXPIRY_REQUIRED/)
  assert.throws(() => grant({ expiresAt: 'someday' }), /AUTHORITY_EXPIRY_REQUIRED/)
})

// ---- evaluation ----

const NOW = '2026-09-09T12:00:00.000Z'
const REQUEST = { action: 'publish_release_note', resources: ['drive:file-a'] }

function evaluate(overrides = {}) {
  return evaluateAuthority({ grant: grant(), request: REQUEST, now: NOW, digest, ...overrides })
}

test('a request inside the granted scope is admitted with an auditable ref', () => {
  const result = evaluate()
  assert.equal(result.ok, true)
  assert.equal(result.ref, 'authority:v1:task-1:nonce-1')
})

test('absence of a grant is never permission', () => {
  assert.deepEqual(evaluate({ grant: null }), { ok: false, reason: 'GRANT_MISSING' })
})

test('AI cannot author authority', () => {
  const forged = { ...grant(), grantedBy: 'chad' }
  assert.equal(evaluate({ grant: forged }).reason, 'GRANT_NOT_HUMAN')
  assert.equal(evaluate({ grant: { ...grant(), grantedBy: '  ' } }).reason, 'GRANT_NOT_HUMAN')
})

test('a scope edited after the digest was pinned is caught before the scope is compared', () => {
  // resources 를 넓히고 digest 는 그대로 둔 위조. scope 비교만 하면 통과해버린다.
  const widened = { ...grant(), scope: { action: 'publish_release_note', resources: ['drive:file-a', 'drive:file-a', 'drive:secret'] } }
  const result = evaluate({ grant: widened, request: { action: 'publish_release_note', resources: ['drive:secret'] } })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'SCOPE_DIGEST_MISMATCH')
})

test('an expired grant is denied', () => {
  assert.equal(evaluate({ now: '2026-09-10T00:00:00.000Z' }).reason, 'EXPIRED')
})

test('a consumed nonce cannot be replayed', () => {
  assert.equal(evaluate({ consumedNonces: ['nonce-1'] }).reason, 'NONCE_REPLAYED')
})

test('a different action is not covered by this approval', () => {
  assert.equal(evaluate({ request: { action: 'delete_file', resources: ['drive:file-a'] } }).reason, 'ACTION_MISMATCH')
})

test('a resource outside the granted set is denied and named', () => {
  const result = evaluate({ request: { action: 'publish_release_note', resources: ['drive:file-a', 'drive:file-z'] } })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'RESOURCE_OUTSIDE_SCOPE')
  assert.equal(result.detail, 'drive:file-z')
})

test('an empty request resource set is denied — an unnamed target is not inside any scope', () => {
  assert.equal(evaluate({ request: { action: 'publish_release_note', resources: [] } }).reason, 'RESOURCE_OUTSIDE_SCOPE')
})
