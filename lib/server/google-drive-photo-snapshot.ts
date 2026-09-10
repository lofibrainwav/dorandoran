import { google } from 'googleapis'
import type { PrivatePhotoJourneyResult } from './private-photo-journey-source.ts'
import {
  normalizeAdapterOutput,
  photoMetadataAdapter,
  projectPastJourneyExperience,
  type ContextObservation,
} from '../family-os/index.ts'
import {
  sanitizePrivatePhotoJourneyResult,
  type PrivatePhotoSnapshotRead,
} from './private-photo-snapshot.ts'

const SNAPSHOT_VERSION = 1
const MAX_SNAPSHOT_BYTES = 512 * 1024

export type GoogleDrivePhotoSnapshotStatus = PrivatePhotoSnapshotRead['status']

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function configured(env: Record<string, string | undefined>) {
  return {
    fileId: clean(env.APPLE_PHOTOS_DRIVE_FILE_ID),
    clientId: clean(env.DRIVE_OUTBOX_CLIENT_ID),
    clientSecret: clean(env.DRIVE_OUTBOX_CLIENT_SECRET),
    refreshToken: clean(env.DRIVE_OUTBOX_REFRESH_TOKEN),
  }
}

function parsePhotoRows(value: unknown, observedAt: string): ContextObservation[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error('PHOTO_SNAPSHOT_PHOTOS_INVALID')
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') throw new Error('PHOTO_SNAPSHOT_PHOTOS_INVALID')
    const row = item as { id?: unknown; capturedAt?: unknown; latitude?: unknown; longitude?: unknown }
    if (typeof row.id !== 'string' || !row.id.trim()) throw new Error('PHOTO_SNAPSHOT_PHOTOS_INVALID')
    const coordinates = typeof row.latitude === 'number' && typeof row.longitude === 'number'
      ? { latitude: row.latitude, longitude: row.longitude }
      : undefined
    if (coordinates && (coordinates.latitude < -90 || coordinates.latitude > 90 || coordinates.longitude < -180 || coordinates.longitude > 180)) {
      throw new Error('PHOTO_SNAPSHOT_PHOTOS_INVALID')
    }
    return normalizeAdapterOutput(photoMetadataAdapter.id, photoMetadataAdapter.normalize({
      id: `apple-photo-memory:${row.id.trim()}`,
      sourceRef: `apple-photos-drive:${row.id.trim()}`,
      evidenceRef: `apple-photos-drive-evidence:${index}`,
      observedAt,
      ...(typeof row.capturedAt === 'string' ? { capturedAt: row.capturedAt } : {}),
      ...(coordinates ? { place: { coordinates } } : {}),
    }))
  })
}

function resultFromPayload(payload: Record<string, unknown>, observedAt: string): PrivatePhotoJourneyResult {
  if (Array.isArray(payload.photos)) {
    const observations = parsePhotoRows(payload.photos, observedAt)
    return {
      source: 'apple-photos-album',
      sourceHealth: 'green',
      selectedCount: observations.length,
      sourceState: 'ready',
      experience: projectPastJourneyExperience({ observations, maxGapMs: 36 * 60 * 60 * 1000 }),
    }
  }
  return sanitizePrivatePhotoJourneyResult(payload.result)
}

function parseSnapshot(raw: string, now: Date, maxAgeMs: number): PrivatePhotoSnapshotRead {
  if (Buffer.byteLength(raw, 'utf8') > MAX_SNAPSHOT_BYTES) {
    return { status: 'invalid', generatedAt: null, result: null }
  }
  try {
    const payload = JSON.parse(raw) as { version?: unknown; generatedAt?: unknown; result?: unknown }
    if (payload.version !== SNAPSHOT_VERSION || typeof payload.generatedAt !== 'string') {
      return { status: 'invalid', generatedAt: null, result: null }
    }
    const generatedMs = Date.parse(payload.generatedAt)
    if (!Number.isFinite(generatedMs) || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
      return { status: 'invalid', generatedAt: null, result: null }
    }
    const ageMs = now.getTime() - generatedMs
    if (!Number.isFinite(ageMs) || ageMs < 0) return { status: 'invalid', generatedAt: null, result: null }
    if (ageMs > maxAgeMs) return { status: 'stale', generatedAt: payload.generatedAt, result: null }
    const result = resultFromPayload(payload, payload.generatedAt)
    return { status: 'fresh', generatedAt: payload.generatedAt, result }
  } catch {
    return { status: 'invalid', generatedAt: null, result: null }
  }
}

/**
 * Reads one user-created, privacy-sanitized Photos snapshot from Drive.
 * This transport never writes Drive and never scans a folder: the exact file id is the boundary.
 */
export async function loadGoogleDrivePhotoSnapshot(input: {
  env?: Record<string, string | undefined>
  now: Date
  maxAgeMs: number
  fetcher?: (fileId: string) => Promise<string>
}): Promise<PrivatePhotoSnapshotRead> {
  const values = configured(input.env ?? process.env)
  if (!values.fileId) return { status: 'missing', generatedAt: null, result: null }
  if (!values.clientId || !values.clientSecret || !values.refreshToken) {
    return { status: 'invalid', generatedAt: null, result: null }
  }

  try {
    const fetcher = input.fetcher ?? (async (fileId: string) => {
      const auth = new google.auth.OAuth2(values.clientId!, values.clientSecret!)
      auth.setCredentials({ refresh_token: values.refreshToken })
      const drive = google.drive({ version: 'v3', auth })
      const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' })
      const data = response.data
      if (typeof data !== 'string') throw new Error('PHOTO_SNAPSHOT_DRIVE_BODY_INVALID')
      return data
    })
    return parseSnapshot(await fetcher(values.fileId), input.now, input.maxAgeMs)
  } catch {
    return { status: 'invalid', generatedAt: null, result: null }
  }
}

export function parseGoogleDrivePhotoSnapshot(input: {
  raw: string
  now: Date
  maxAgeMs: number
}): PrivatePhotoSnapshotRead {
  return parseSnapshot(input.raw, input.now, input.maxAgeMs)
}

export type GoogleDrivePhotoSnapshotResult = PrivatePhotoJourneyResult
