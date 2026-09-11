import test from 'node:test'
import assert from 'node:assert/strict'
import {
  APPLE_DIGITAL_ATOM_PROTOCOL_VERSION,
  canonicalAppleDigitalAtomBatch,
  parseAppleDigitalAtomBatch,
} from '../../lib/family-os/apple-digital-atom.ts'

function batch(source = 'calendar', events = undefined) {
  return {
    protocolVersion: APPLE_DIGITAL_ATOM_PROTOCOL_VERSION,
    deviceId: 'iphone-jay-01',
    source,
    cursor: 'cursor-1',
    sentAt: '2026-09-10T19:00:00Z',
    events: events ?? [{
      eventId: 'event-1',
      operation: 'upsert',
      kind: 'schedule',
      occurredAt: '2026-09-10T18:00:00Z',
      metadata: {
        eventId: 'event-1',
        calendarId: 'family',
        title: 'Jayden swimming',
        start: '2026-09-10T18:45:00-07:00',
        end: '2026-09-10T19:45:00-07:00',
        timeZone: 'America/Los_Angeles',
        allDay: false,
        status: 'confirmed',
        modifiedAt: '2026-09-10T17:00:00Z',
      },
    }],
  }
}

test('normalizes a calendar metadata-only batch', () => {
  const parsed = parseAppleDigitalAtomBatch(batch())
  assert.equal(parsed?.source, 'calendar')
  assert.equal(parsed?.events[0].metadata.title, 'Jayden swimming')
  assert.equal(parsed?.events[0].metadata.start, '2026-09-10T18:45:00-07:00')
})

test('accepts source-specific reminders, shortcuts, and home kinds', () => {
  for (const [source, kind, metadata] of [
    ['reminders', 'reminder', { reminderId: 'r1', listId: 'family', title: 'Pack swim bag', completed: false }],
    ['shortcuts', 'action.completed', { shortcutName: 'Family Capture', actionId: 'capture.create', completedAt: '2026-09-10T18:00:00Z' }],
    ['home', 'home.state', { homeId: 'home-1', roomId: 'kitchen', accessoryLabel: 'Kitchen light', state: 'on', observedAt: '2026-09-10T18:00:00Z' }],
  ]) {
    const parsed = parseAppleDigitalAtomBatch(batch(source, [{
      eventId: `${source}-1`, operation: 'upsert', kind, occurredAt: '2026-09-10T18:00:00Z', metadata,
    }]))
    assert.equal(parsed?.events[0].kind, kind)
  }
})

test('delete events contain no metadata payload', () => {
  const parsed = parseAppleDigitalAtomBatch(batch('calendar', [{
    eventId: 'event-1', operation: 'delete', kind: 'schedule', occurredAt: '2026-09-10T18:00:00Z', metadata: {},
  }]))
  assert.deepEqual(parsed?.events[0].metadata, {})
})

test('rejects raw or unsupported metadata fields and mismatched kinds', () => {
  assert.equal(parseAppleDigitalAtomBatch(batch('calendar', [{
    eventId: 'event-1', operation: 'upsert', kind: 'schedule', occurredAt: '2026-09-10T18:00:00Z',
    metadata: { title: 'ok', privateNotes: 'must not cross the boundary' },
  }])), null)
  assert.equal(parseAppleDigitalAtomBatch(batch('home', [{
    eventId: 'home-1', operation: 'upsert', kind: 'schedule', occurredAt: '2026-09-10T18:00:00Z', metadata: {},
  }])), null)
})

test('canonical representation is stable after normalization', () => {
  const parsed = parseAppleDigitalAtomBatch(batch())
  assert.ok(parsed)
  assert.equal(canonicalAppleDigitalAtomBatch(parsed), JSON.stringify(parsed))
})
