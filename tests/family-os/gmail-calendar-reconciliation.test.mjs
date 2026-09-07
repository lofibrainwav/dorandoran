import test from 'node:test'
import assert from 'node:assert/strict'
import {
  materializeProviderEventFactClaim,
  normalizeGoogleCalendarEvent,
  normalizePrivateGmailMessage,
  reconcileCalendarEventReality,
} from '../../lib/family-os/index.ts'

function calendarEvent() {
  return normalizeGoogleCalendarEvent({
    id: 'aba-thu', summary: 'ABA Center', start: '15:30', end: '18:30',
    location: '12660 Riverside Drive',
  }, { calendarId: 'family', observedAt: '2026-09-01T12:00:00Z' })
}

function providerSource() {
  return normalizePrivateGmailMessage({
    accountId: 'julie@gmail.com', observedAt: '2026-09-02T12:00:00Z',
    raw: { id: 'provider-msg', snippet: 'Private schedule update', payload: { headers: [
      { name: 'From', value: 'Rebecca <rebecca@cardcenter.org>' },
    ] } },
  })
}

const provider = { id: 'card', verifiedDomains: ['cardcenter.org'] }

function providerClaim(fact, value, id = fact) {
  const source = providerSource()
  return materializeProviderEventFactClaim({ source, provider, observation: {
    id, targetEventId: 'calendar:family:aba-thu', fact, value, explicit: true,
    evidenceRef: source.evidenceRef.id,
  } })
}
test('verified provider start overrides Family Calendar start only', () => {
  const result = reconcileCalendarEventReality({
    event: calendarEvent(), calendarSourceRole: 'family_calendar',
    providerClaims: [providerClaim('start', '15:00')],
  })
  assert.equal(result.reality.start, '15:00')
  assert.equal(result.reality.end, '18:30')
  assert.equal(result.reality.location, '12660 Riverside Drive')
  assert.equal(result.protected, true)
})

test('provider location stays on the location axis', () => {
  const result = reconcileCalendarEventReality({
    event: calendarEvent(), calendarSourceRole: 'family_calendar',
    providerClaims: [providerClaim('location', 'New Center')],
  })
  assert.equal(result.reality.start, '15:30')
  assert.equal(result.reality.location, 'New Center')
})

test('explicit provider cancellation can close an occurrence without erasing schedule truth', () => {
  const result = reconcileCalendarEventReality({
    event: calendarEvent(), calendarSourceRole: 'family_calendar',
    providerClaims: [providerClaim('cancelled', true, 'closed')],
  })
  assert.equal(result.reality.cancelled, true)
  assert.equal(result.reality.start, '15:30')
})
test('claim targeting a different event fails closed', () => {
  const source = providerSource()
  const wrong = materializeProviderEventFactClaim({ source, provider, observation: {
    id: 'wrong-target', targetEventId: 'other-event', fact: 'start', value: '15:00', explicit: true,
    evidenceRef: source.evidenceRef.id,
  } })
  assert.throws(() => reconcileCalendarEventReality({
    event: calendarEvent(), calendarSourceRole: 'family_calendar', providerClaims: [wrong],
  }), /FACT_CLAIM_TARGET_MISMATCH/)
})

test('reconciled projection cannot leak private Gmail text', () => {
  const result = reconcileCalendarEventReality({
    event: calendarEvent(), calendarSourceRole: 'family_calendar',
    providerClaims: [providerClaim('start', '15:00')],
  })
  assert.equal(JSON.stringify(result).includes('Private schedule update'), false)
  assert.equal(JSON.stringify(result).includes('Rebecca'), false)
})
