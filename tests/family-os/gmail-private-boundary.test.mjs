import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizePrivateGmailMessage,
  projectPrivateGmailEvidence,
} from '../../lib/family-os/index.ts'

const rawMessage = {
  id: '18abc123',
  threadId: 'thread-7',
  snippet: 'Thursday ABA will start at 3:00 PM.',
  internalDate: '1788751800000',
  payload: {
    headers: [
      { name: 'fRoM', value: 'Rebecca Alvarez <rebecca@example.org>' },
      { name: 'SUBJECT', value: 'Schedule update' },
    ],
    body: { data: 'VGh1cnNkYXkgQUJBIHdpbGwgc3RhcnQgYXQgMzowMCBQTS4' },
  },
}

test('Gmail REST payload normalizes into a private envelope with stable evidence identity', () => {
  const envelope = normalizePrivateGmailMessage({
    accountId: 'jayden@gmail.com', raw: rawMessage, observedAt: '2026-09-07T06:00:00.000Z',
  })
  assert.equal(envelope.messageId, '18abc123')
  assert.equal(envelope.evidenceRef.id, 'gmail:jayden@gmail.com:18abc123')
  assert.equal(envelope.headers.from, 'Rebecca Alvarez <rebecca@example.org>')
  assert.equal(envelope.headers.subject, 'Schedule update')
})
test('safe Gmail projection never exposes raw body, snippet, subject, or sender by default', () => {
  const envelope = normalizePrivateGmailMessage({
    accountId: 'jayden@gmail.com', raw: rawMessage, observedAt: '2026-09-07T06:00:00.000Z',
  })
  const safe = projectPrivateGmailEvidence(envelope)
  const serialized = JSON.stringify(safe)
  assert.equal(safe.messageId, '18abc123')
  assert.equal(safe.evidenceRef.id, 'gmail:jayden@gmail.com:18abc123')
  assert.equal(serialized.includes('Thursday ABA'), false)
  assert.equal(serialized.includes('Schedule update'), false)
  assert.equal(serialized.includes('Rebecca Alvarez'), false)
  assert.equal('claims' in safe, false)
})

test('sender domain is exposed only when explicitly requested', () => {
  const envelope = normalizePrivateGmailMessage({
    accountId: 'jayden@gmail.com', raw: rawMessage, observedAt: '2026-09-07T06:00:00.000Z',
  })
  const safe = projectPrivateGmailEvidence(envelope, { includeSenderDomain: true })
  assert.equal(safe.senderDomain, 'example.org')
  assert.equal(JSON.stringify(safe).includes('Rebecca Alvarez'), false)
})

test('missing Gmail message id fails closed', () => {
  assert.throws(() => normalizePrivateGmailMessage({
    accountId: 'jayden@gmail.com', raw: { snippet: 'x' }, observedAt: '2026-09-07T06:00:00.000Z',
  }), /GMAIL_MESSAGE_ID_MISSING/)
})