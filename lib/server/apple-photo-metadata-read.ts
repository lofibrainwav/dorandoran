import {
  normalizeAdapterOutput,
  photoMetadataAdapter,
  projectPastJourneyExperience,
  type PastJourneyExperienceProjection,
} from '../family-os/index.ts'
import { resolvePostgresConnectionString } from './postgres-connection.ts'

export type ApplePhotoProjectionStatus = 'live' | 'stale' | 'offline'

export interface ApplePhotoMetadataProjectionRead {
  status: ApplePhotoProjectionStatus
  lastSyncedAt: string | null
  selectedCount: number
  experience: PastJourneyExperienceProjection
}

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number | null }

function emptyExperience(): PastJourneyExperienceProjection {
  return projectPastJourneyExperience({ observations: [], maxGapMs: 36 * 60 * 60 * 1000 })
}

function timestamp(value: unknown): string | null {
  const result = value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : null
  return result && Number.isFinite(Date.parse(result)) ? result : null
}

function rowsToExperience(rows: Record<string, unknown>[], observedAt: string): PastJourneyExperienceProjection {
  const observations = rows.flatMap((row, index) => {
    const cloudId = typeof row.cloud_id === 'string' ? row.cloud_id.trim() : ''
    const capturedAt = timestamp(row.captured_at)
    const observed = timestamp(row.observed_at) ?? observedAt
    if (!cloudId || !capturedAt || !observed) return []
    const latitude = typeof row.latitude === 'number' ? row.latitude : undefined
    const longitude = typeof row.longitude === 'number' ? row.longitude : undefined
    const coordinates = latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined
    return normalizeAdapterOutput(photoMetadataAdapter.id, photoMetadataAdapter.normalize({
      id: `apple-photo-memory:${cloudId}`,
      sourceRef: 'apple-photos-metadata-stream',
      evidenceRef: `apple-photos-stream-evidence:${index}`,
      observedAt: observed,
      capturedAt,
      ...(coordinates ? { place: { coordinates } } : {}),
    }))
  })
  return projectPastJourneyExperience({ observations, maxGapMs: 36 * 60 * 60 * 1000 })
}

export async function loadApplePhotoMetadataProjection(input: {
  env?: Record<string, string | undefined>
  now: Date
  maxAgeMs: number
  limit?: number
}): Promise<ApplePhotoMetadataProjectionRead> {
  const connectionString = resolvePostgresConnectionString({
    DATABASE_URL: (input.env ?? process.env).DATABASE_URL,
    POSTGRES_URL: (input.env ?? process.env).POSTGRES_URL,
  })
  const limit = input.limit ?? 500
  if (!connectionString || !Number.isInteger(limit) || limit < 1 || limit > 500) {
    return { status: 'offline', lastSyncedAt: null, selectedCount: 0, experience: emptyExperience() }
  }

  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000 })
  try {
    const result = await pool.query(
      `SELECT m.cloud_id, m.captured_at, m.latitude, m.longitude, m.observed_at,
              c.updated_at AS last_synced_at
         FROM apple_photo_metadata m
         CROSS JOIN (
           SELECT MAX(updated_at) AS updated_at
             FROM apple_photo_cursor
            WHERE library_scope = 'family-shared'
         ) c
        WHERE m.library_scope = 'family-shared'
          AND m.deleted_at IS NULL
        ORDER BY m.captured_at DESC
        LIMIT $1`,
      [limit],
    ) as QueryResult
    const lastSyncedAt = timestamp(result.rows[0]?.last_synced_at)
    if (!lastSyncedAt) return { status: 'offline', lastSyncedAt: null, selectedCount: 0, experience: emptyExperience() }
    const ageMs = input.now.getTime() - Date.parse(lastSyncedAt)
    const status: ApplePhotoProjectionStatus = Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= input.maxAgeMs ? 'live' : 'stale'
    return {
      status,
      lastSyncedAt,
      selectedCount: result.rows.length,
      experience: rowsToExperience(result.rows, lastSyncedAt),
    }
  } catch {
    return { status: 'offline', lastSyncedAt: null, selectedCount: 0, experience: emptyExperience() }
  } finally {
    await pool.end()
  }
}
