/**
 * Provider-neutral, metadata-only transport for Apple Calendar, Reminders,
 * Shortcuts, and HomeKit. Photos keeps its existing dedicated stream contract.
 */

export const APPLE_DIGITAL_ATOM_PROTOCOL_VERSION = 1 as const
export const APPLE_DIGITAL_ATOM_MAX_EVENTS = 200
export const APPLE_DIGITAL_ATOM_MAX_STRING_LENGTH = 512

export type AppleDigitalAtomSource = 'calendar' | 'reminders' | 'shortcuts' | 'home'
export type AppleDigitalAtomOperation = 'upsert' | 'delete'
export type AppleDigitalAtomKind = 'schedule' | 'reminder' | 'action.completed' | 'home.state'
export type AppleDigitalAtomScalar = string | number | boolean | null

export interface AppleDigitalAtomMetadata {
  [key: string]: AppleDigitalAtomScalar
}

export interface AppleDigitalAtomEvent {
  eventId: string
  operation: AppleDigitalAtomOperation
  kind: AppleDigitalAtomKind
  occurredAt: string
  metadata: AppleDigitalAtomMetadata
}

export interface AppleDigitalAtomBatch {
  protocolVersion: typeof APPLE_DIGITAL_ATOM_PROTOCOL_VERSION
  deviceId: string
  source: AppleDigitalAtomSource
  cursor: string
  sentAt: string
  events: AppleDigitalAtomEvent[]
}

const SOURCES: AppleDigitalAtomSource[] = ['calendar', 'reminders', 'shortcuts', 'home']
const OPERATIONS: AppleDigitalAtomOperation[] = ['upsert', 'delete']
const KINDS: AppleDigitalAtomKind[] = ['schedule', 'reminder', 'action.completed', 'home.state']
const TOP_LEVEL_KEYS = ['protocolVersion', 'deviceId', 'source', 'cursor', 'sentAt', 'events']
const EVENT_KEYS = ['eventId', 'operation', 'kind', 'occurredAt', 'metadata']

const ALLOWED_METADATA_KEYS: Record<AppleDigitalAtomSource, string[]> = {
  calendar: ['eventId', 'calendarId', 'title', 'start', 'end', 'timeZone', 'location', 'allDay', 'status', 'modifiedAt'],
  reminders: ['reminderId', 'listId', 'title', 'dueAt', 'completed', 'modifiedAt', 'priority'],
  shortcuts: ['shortcutName', 'actionId', 'completedAt', 'resultRef'],
  home: ['homeId', 'roomId', 'accessoryId', 'accessoryLabel', 'state', 'observedAt'],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function boundedString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field}_INVALID`)
  const normalized = value.trim()
  if (!normalized || normalized.length > APPLE_DIGITAL_ATOM_MAX_STRING_LENGTH) throw new Error(`${field}_INVALID`)
  return normalized
}

function isoTimestamp(value: unknown, field: string): string {
  const normalized = boundedString(value, field)
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) throw new Error(`${field}_INVALID`)
  return date.toISOString()
}

function parseMetadata(value: unknown, source: AppleDigitalAtomSource, operation: AppleDigitalAtomOperation): AppleDigitalAtomMetadata {
  if (!isRecord(value)) throw new Error('METADATA_INVALID')
  const allowed = new Set(ALLOWED_METADATA_KEYS[source])
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error('METADATA_FIELD_UNSUPPORTED')
  if (operation === 'delete' && Object.keys(value).length !== 0) throw new Error('DELETE_METADATA_MUST_BE_EMPTY')

  const metadata: AppleDigitalAtomMetadata = {}
  for (const [key, item] of Object.entries(value)) {
    if (!(typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item === null)) {
      throw new Error('METADATA_VALUE_INVALID')
    }
    if (typeof item === 'string' && item.length > APPLE_DIGITAL_ATOM_MAX_STRING_LENGTH) throw new Error('METADATA_VALUE_INVALID')
    if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('METADATA_VALUE_INVALID')
    metadata[key] = item
  }
  return metadata
}

function validKind(source: AppleDigitalAtomSource, kind: AppleDigitalAtomKind): boolean {
  return (source === 'calendar' && kind === 'schedule')
    || (source === 'reminders' && kind === 'reminder')
    || (source === 'shortcuts' && kind === 'action.completed')
    || (source === 'home' && kind === 'home.state')
}

function parseEvent(value: unknown, source: AppleDigitalAtomSource): AppleDigitalAtomEvent {
  if (!isRecord(value) || !hasExactKeys(value, EVENT_KEYS)) throw new Error('EVENT_INVALID')
  const operation = value.operation
  const kind = value.kind
  if (typeof operation !== 'string' || !OPERATIONS.includes(operation as AppleDigitalAtomOperation)) throw new Error('OPERATION_INVALID')
  if (typeof kind !== 'string' || !KINDS.includes(kind as AppleDigitalAtomKind) || !validKind(source, kind as AppleDigitalAtomKind)) throw new Error('KIND_INVALID')
  return {
    eventId: boundedString(value.eventId, 'EVENT_ID'),
    operation: operation as AppleDigitalAtomOperation,
    kind: kind as AppleDigitalAtomKind,
    occurredAt: isoTimestamp(value.occurredAt, 'OCCURRED_AT'),
    metadata: parseMetadata(value.metadata, source, operation as AppleDigitalAtomOperation),
  }
}

/** Returns a normalized batch or null for an invalid/untrusted payload. */
export function parseAppleDigitalAtomBatch(value: unknown): AppleDigitalAtomBatch | null {
  try {
    if (!isRecord(value) || !hasExactKeys(value, TOP_LEVEL_KEYS)) return null
    if (value.protocolVersion !== APPLE_DIGITAL_ATOM_PROTOCOL_VERSION) return null
    if (typeof value.source !== 'string' || !SOURCES.includes(value.source as AppleDigitalAtomSource)) return null
    if (!Array.isArray(value.events) || value.events.length > APPLE_DIGITAL_ATOM_MAX_EVENTS) return null
    const source = value.source as AppleDigitalAtomSource
    return {
      protocolVersion: APPLE_DIGITAL_ATOM_PROTOCOL_VERSION,
      deviceId: boundedString(value.deviceId, 'DEVICE_ID'),
      source,
      cursor: boundedString(value.cursor, 'CURSOR'),
      sentAt: isoTimestamp(value.sentAt, 'SENT_AT'),
      events: value.events.map((event) => parseEvent(event, source)),
    }
  } catch {
    return null
  }
}

export function canonicalAppleDigitalAtomBatch(batch: AppleDigitalAtomBatch): string {
  return JSON.stringify(batch)
}
