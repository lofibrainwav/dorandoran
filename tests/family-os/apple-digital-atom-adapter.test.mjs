import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAppleDigitalAtomBatch } from '../../lib/family-os/apple-digital-atom-adapter.ts'
import { parseAppleDigitalAtomBatch } from '../../lib/family-os/apple-digital-atom.ts'

function parsed(source, kind, metadata, operation = 'upsert') {
  return parseAppleDigitalAtomBatch({
    protocolVersion: 1,
    deviceId: 'iphone-1',
    source,
    cursor: 'cursor-1',
    sentAt: '2026-09-10T19:00:00Z',
    events: [{ eventId: `${source}-1`, operation, kind, occurredAt: '2026-09-10T18:00:00Z', metadata }],
  })
}

test('projects Apple Calendar metadata into the shared 6W1H observation', () => {
  const batch = parsed('calendar', 'schedule', {
    eventId: 'event-1', calendarId: 'family', title: 'Jayden swimming',
    start: '2026-09-10T18:45:00-07:00', end: '2026-09-10T19:45:00-07:00',
    timeZone: 'America/Los_Angeles', location: 'Waterwings',
  })
  assert.ok(batch)
  const [observation] = normalizeAppleDigitalAtomBatch(batch)
  assert.equal(observation.kind, 'apple.calendar.schedule')
  assert.equal(observation.sixW1H.what.label, 'Jayden swimming')
  assert.equal(observation.sixW1H.where.label, 'Waterwings')
  assert.equal(observation.evidenceState, 'confirmed')
})

test('projects reminders without creating a lifecycle Task', () => {
  const batch = parsed('reminders', 'reminder', { reminderId: 'r1', listId: 'family', title: 'Pack swim bag', dueAt: '2026-09-10T17:00:00Z' })
  assert.ok(batch)
  const [observation] = normalizeAppleDigitalAtomBatch(batch)
  assert.equal(observation.kind, 'apple.reminders.reminder')
  assert.equal(observation.sixW1H.what.label, 'Pack swim bag')
  assert.equal(observation.sixW1H.when.start, '2026-09-10T17:00:00.000Z')
})

test('Home state stays context and never becomes live presence', () => {
  const batch = parsed('home', 'home.state', { homeId: 'home-1', roomId: 'kitchen', accessoryLabel: 'Kitchen light', state: 'on' })
  assert.ok(batch)
  const [observation] = normalizeAppleDigitalAtomBatch(batch)
  assert.equal(observation.kind, 'apple.home.home.state')
  assert.equal(observation.sixW1H.where.placeRef, 'apple-home-room:kitchen')
  assert.equal(observation.sixW1H.what.label, 'Kitchen light · on')
  assert.equal('presence' in observation, false)
})

test('deletion observations remain stale and preserve continuity identity', () => {
  const batch = parsed('calendar', 'schedule', {}, 'delete')
  assert.ok(batch)
  const [observation] = normalizeAppleDigitalAtomBatch(batch)
  assert.equal(observation.evidenceState, 'stale')
  assert.equal(observation.continuity.priorObservationRef, 'cursor-1')
})
