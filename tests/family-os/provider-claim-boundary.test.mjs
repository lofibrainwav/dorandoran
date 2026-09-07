import test from 'node:test'
import assert from 'node:assert/strict'
import {
  materializeProviderFactClaim,
  normalizePrivateGmailMessage,
} from '../../lib/family-os/index.ts'

function envelope(from = 'Rebecca Alvarez <rebecca@cardcenter.org>') {
  return normalizePrivateGmailMessage({
    accountId: 'jayden@gmail.com',
    observedAt: '2026-09-06T18:00:00.000Z',
    raw: {
      id: 'msg-provider-1',
      snippet: 'private schedule text',
      payload: { headers: [
        { name: 'From', value: from },
        { name: 'Subject', value: 'Schedule' },
      ] },
    },
  })
}

const provider = {
  id: 'card-center',
  verifiedEmails: ['rebecca@cardcenter.org'],
  verifiedDomains: ['cardcenter.org'],
}

test('verified explicit provider observation becomes direct_official FactClaim', () => {
  const source = envelope()
  const claim = materializeProviderFactClaim({ source, provider, observation: {
    id: 'start-3pm', fact: 'start', value: '15:00', explicit: true,
    evidenceRef: source.evidenceRef.id,
  } })
  assert.equal(claim?.fact, 'start')
  assert.equal(claim?.value, '15:00')
  assert.equal(claim?.sourceRole, 'direct_official')
  assert.equal(claim?.evidenceRef, source.evidenceRef.id)
  assert.equal(claim?.observedAt, source.observedAt)
  assert.equal(JSON.stringify(claim).includes('private schedule text'), false)
})

test('ambiguous provider observation produces no claim', () => {
  const source = envelope()
  const claim = materializeProviderFactClaim({ source, provider, observation: {
    id: 'maybe-time', fact: 'start', value: '15:00', explicit: false,
    evidenceRef: source.evidenceRef.id,
  } })
  assert.equal(claim, null)
})

test('unverified sender cannot become direct_official', () => {
  const source = envelope('Unknown <person@random.example>')
  assert.throws(() => materializeProviderFactClaim({ source, provider, observation: {
    id: 'start-3pm', fact: 'start', value: '15:00', explicit: true,
    evidenceRef: source.evidenceRef.id,
  } }), /PROVIDER_SENDER_UNVERIFIED/)
})
test('observation must point to the exact Gmail evidenceRef', () => {
  const source = envelope()
  assert.throws(() => materializeProviderFactClaim({ source, provider, observation: {
    id: 'wrong-ref', fact: 'location', value: '12660 Riverside Drive', explicit: true,
    evidenceRef: 'gmail:other:message',
  } }), /PROVIDER_EVIDENCE_MISMATCH/)
})

test('cancelled fact requires a boolean value', () => {
  const source = envelope()
  assert.throws(() => materializeProviderFactClaim({ source, provider, observation: {
    id: 'closed', fact: 'cancelled', value: 'yes', explicit: true,
    evidenceRef: source.evidenceRef.id,
  } }), /PROVIDER_FACT_VALUE_INVALID/)
})
