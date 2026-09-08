import test from 'node:test'
import assert from 'node:assert/strict'

import { decideExternalAction } from '../../lib/server/external-action-policy.ts'

const email = {
  kind: 'email_send',
  actionId: 'weekly-prep:2026-09-13',
  recipientFingerprint: 'to:Jangj@hotmail.com',
  contentFingerprint: 'sha256:final-message-v1',
}

const humanApproval = {
  kind: 'human_approval',
  actionKind: 'email_send',
  actionId: email.actionId,
  recipientFingerprint: email.recipientFingerprint,
  contentFingerprint: email.contentFingerprint,
  approvedByType: 'human',
  approvedByPersonId: 'jay',
  expiresAtEpochMs: 2_000,
  consumed: false,
}

test('email send fails closed without explicit human approval', () => {
  assert.deepEqual(decideExternalAction({ request: email, approval: null, nowEpochMs: 1_000 }), {
    kind: 'deny',
    reason: 'HUMAN_APPROVAL_REQUIRED',
  })
})

test('automation or agent approval can never authorize an email send', () => {
  assert.deepEqual(
    decideExternalAction({
      request: email,
      approval: { ...humanApproval, approvedByType: 'agent' },
      nowEpochMs: 1_000,
    }),
    { kind: 'deny', reason: 'HUMAN_APPROVAL_REQUIRED' },
  )
})

test('approval is bound to the exact action, recipient, and content', () => {
  for (const approval of [
    { ...humanApproval, actionId: 'different' },
    { ...humanApproval, recipientFingerprint: 'to:someone-else@example.com' },
    { ...humanApproval, contentFingerprint: 'sha256:changed-message' },
  ]) {
    assert.deepEqual(decideExternalAction({ request: email, approval, nowEpochMs: 1_000 }), {
      kind: 'deny',
      reason: 'APPROVAL_MISMATCH',
    })
  }
})

test('expired or consumed approval cannot be reused', () => {
  assert.deepEqual(
    decideExternalAction({ request: email, approval: humanApproval, nowEpochMs: 2_001 }),
    { kind: 'deny', reason: 'APPROVAL_EXPIRED' },
  )
  assert.deepEqual(
    decideExternalAction({ request: email, approval: { ...humanApproval, consumed: true }, nowEpochMs: 1_000 }),
    { kind: 'deny', reason: 'APPROVAL_CONSUMED' },
  )
})

test('an exact, current, unconsumed human approval authorizes one email send', () => {
  assert.deepEqual(decideExternalAction({ request: email, approval: humanApproval, nowEpochMs: 1_000 }), {
    kind: 'allow',
    approvedByPersonId: 'jay',
  })
})

test('creating an email draft is not the same authority boundary as sending it', () => {
  assert.deepEqual(
    decideExternalAction({
      request: { kind: 'email_draft', actionId: 'draft:1' },
      approval: null,
      nowEpochMs: 1_000,
    }),
    { kind: 'allow' },
  )
})
