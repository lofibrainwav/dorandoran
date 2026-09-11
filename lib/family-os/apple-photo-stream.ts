/**
 * Privacy-safe delta contract for an iPhone PhotoKit companion.
 *
 * This module deliberately contains no image, video, thumbnail, or raw EXIF
 * fields. It is safe to share with the client companion and the server route.
 */

export const APPLE_PHOTO_STREAM_VERSION = 1 as const
export const APPLE_PHOTO_STREAM_MAX_EVENTS = 500
export const APPLE_PHOTO_STREAM_MAX_STRING_LENGTH = 512

export type ApplePhotoLibraryScope = 'family-shared'
export type ApplePhotoEventOperation = 'upsert' | 'delete'
export type ApplePhotoMediaType = 'image' | 'video' | 'live_photo' | 'unknown'

export interface ApplePhotoMetadata {
  cloudId: string
  capturedAt: string
  modifiedAt: string
  mediaType: ApplePhotoMediaType
  latitude?: number
  longitude?: number
}

export interface ApplePhotoUpsertEvent {
  operation: 'upsert'
  photo: ApplePhotoMetadata
}

export interface ApplePhotoDeleteEvent {
  operation: 'delete'
  cloudId: string
}

export type ApplePhotoStreamEvent = ApplePhotoUpsertEvent | ApplePhotoDeleteEvent

export interface ApplePhotoMetadataBatch {
  protocolVersion: typeof APPLE_PHOTO_STREAM_VERSION
  deviceId: string
  libraryScope: ApplePhotoLibraryScope
  cursor: string
  sentAt: string
  events: ApplePhotoStreamEvent[]
}

const TOP_LEVEL_KEYS = ['protocolVersion', 'deviceId', 'libraryScope', 'cursor', 'sentAt', 'events']
const UPSERT_KEYS = ['operation', 'photo']
const DELETE_KEYS = ['operation', 'cloudId']
const PHOTO_KEYS = ['cloudId', 'capturedAt', 'modifiedAt', 'mediaType', 'latitude', 'longitude']
const MEDIA_TYPES: ApplePhotoMediaType[] = ['image', 'video', 'live_photo', 'unknown']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
}

function hasAllowedKeys(value: Record<string, unknown>, required: string[], optional: string[]): boolean {
  const allowed = new Set([...required, ...optional])
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) && Object.keys(value).every((key) => allowed.has(key))
}

function boundedString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`)
  const normalized = value.trim()
  if (!normalized || normalized.length > APPLE_PHOTO_STREAM_MAX_STRING_LENGTH) {
    throw new Error(`${field} must be non-empty and bounded`)
  }
  return normalized
}

function isoTimestamp(value: unknown, field: string): string {
  const normalized = boundedString(value, field)
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) throw new Error(`${field} must be an ISO timestamp`)
  return date.toISOString()
}

function coordinate(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${field} is outside the valid range`)
  }
  return value
}

function parsePhoto(value: unknown): ApplePhotoMetadata {
  if (!isRecord(value) || !hasAllowedKeys(value, PHOTO_KEYS.slice(0, 4), PHOTO_KEYS.slice(4))) throw new Error('photo contains unsupported fields')

  const latitude = value.latitude === undefined ? undefined : coordinate(value.latitude, 'latitude', -90, 90)
  const longitude = value.longitude === undefined ? undefined : coordinate(value.longitude, 'longitude', -180, 180)
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new Error('latitude and longitude must be supplied together')
  }

  const mediaType = value.mediaType
  if (typeof mediaType !== 'string' || !MEDIA_TYPES.includes(mediaType as ApplePhotoMediaType)) {
    throw new Error('mediaType is unsupported')
  }

  return {
    cloudId: boundedString(value.cloudId, 'cloudId'),
    capturedAt: isoTimestamp(value.capturedAt, 'capturedAt'),
    modifiedAt: isoTimestamp(value.modifiedAt, 'modifiedAt'),
    mediaType: mediaType as ApplePhotoMediaType,
    ...(latitude === undefined ? {} : { latitude, longitude }),
  }
}

function parseEvent(value: unknown): ApplePhotoStreamEvent {
  if (!isRecord(value) || typeof value.operation !== 'string') throw new Error('event is malformed')

  if (value.operation === 'upsert') {
    if (!hasExactKeys(value, UPSERT_KEYS)) throw new Error('upsert event contains unsupported fields')
    return { operation: 'upsert', photo: parsePhoto(value.photo) }
  }

  if (value.operation === 'delete') {
    if (!hasExactKeys(value, DELETE_KEYS)) throw new Error('delete event contains unsupported fields')
    return { operation: 'delete', cloudId: boundedString(value.cloudId, 'cloudId') }
  }

  throw new Error('operation is unsupported')
}

/** Returns a normalized batch or null for an invalid/untrusted payload. */
export function parseApplePhotoMetadataBatch(value: unknown): ApplePhotoMetadataBatch | null {
  try {
    if (!isRecord(value) || !hasExactKeys(value, TOP_LEVEL_KEYS)) return null
    if (value.protocolVersion !== APPLE_PHOTO_STREAM_VERSION) return null
    if (value.libraryScope !== 'family-shared') return null
    if (!Array.isArray(value.events) || value.events.length > APPLE_PHOTO_STREAM_MAX_EVENTS) return null

    return {
      protocolVersion: APPLE_PHOTO_STREAM_VERSION,
      deviceId: boundedString(value.deviceId, 'deviceId'),
      libraryScope: 'family-shared',
      cursor: boundedString(value.cursor, 'cursor'),
      sentAt: isoTimestamp(value.sentAt, 'sentAt'),
      events: value.events.map(parseEvent),
    }
  } catch {
    return null
  }
}

/** Stable representation for server-side idempotency keys and audit receipts. */
export function canonicalApplePhotoMetadataBatch(batch: ApplePhotoMetadataBatch): string {
  return JSON.stringify({
    protocolVersion: batch.protocolVersion,
    deviceId: batch.deviceId,
    libraryScope: batch.libraryScope,
    cursor: batch.cursor,
    sentAt: batch.sentAt,
    events: batch.events.map((event) =>
      event.operation === 'delete'
        ? { operation: 'delete', cloudId: event.cloudId }
        : {
            operation: 'upsert',
            photo: {
              cloudId: event.photo.cloudId,
              capturedAt: event.photo.capturedAt,
              modifiedAt: event.photo.modifiedAt,
              mediaType: event.photo.mediaType,
              ...(event.photo.latitude === undefined
                ? {}
                : { latitude: event.photo.latitude, longitude: event.photo.longitude }),
            },
          },
    ),
  })
}
