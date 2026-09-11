import { createHash } from 'node:crypto'
import {
  canonicalApplePhotoMetadataBatch,
  type ApplePhotoMetadataBatch,
  parseApplePhotoMetadataBatch,
} from '../family-os/apple-photo-stream.ts'

export type ApplePhotoQueryResult = { rows: Record<string, unknown>[]; rowCount: number | null }
export type ApplePhotoQuery = (text: string, params?: unknown[]) => Promise<ApplePhotoQueryResult>
export type ApplePhotoTransaction = <T>(run: (query: ApplePhotoQuery) => Promise<T>) => Promise<T>

export interface ApplePhotoIngestResult {
  status: 'accepted' | 'duplicate'
  batchDigest: string
  eventCount: number
  cursor: string
}

function required(value: string, code: string): string {
  const result = value.trim()
  if (!result) throw new Error(code)
  return result
}

export function applePhotoBatchDigest(batch: ApplePhotoMetadataBatch): string {
  return createHash('sha256').update(canonicalApplePhotoMetadataBatch(batch), 'utf8').digest('hex')
}

export function createPostgresApplePhotoStreamStore(input: {
  query: ApplePhotoQuery
  transaction: ApplePhotoTransaction
}): { ingest(value: unknown): Promise<ApplePhotoIngestResult> } {
  return {
    async ingest(value) {
      const batch = parseApplePhotoMetadataBatch(value)
      if (!batch) throw new Error('APPLE_PHOTO_BATCH_INVALID')
      const digest = applePhotoBatchDigest(batch)
      return input.transaction(async (query) => {
        const receipt = await query(
          `INSERT INTO apple_photo_event_receipt
             (library_scope, device_id, batch_digest, cursor, received_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (library_scope, device_id, batch_digest) DO NOTHING
           RETURNING batch_digest`,
          [batch.libraryScope, batch.deviceId, digest, batch.cursor, batch.sentAt],
        )
        if (!receipt.rowCount) return { status: 'duplicate', batchDigest: digest, eventCount: batch.events.length, cursor: batch.cursor }

        for (const event of batch.events) {
          if (event.operation === 'delete') {
            await query(
              `UPDATE apple_photo_metadata
                  SET deleted_at = $4, observed_at = $4, device_id = $2, updated_at = $4
                WHERE library_scope = $1 AND cloud_id = $3`,
              [batch.libraryScope, batch.deviceId, event.cloudId, batch.sentAt],
            )
            continue
          }

          await query(
            `INSERT INTO apple_photo_metadata
              (library_scope, cloud_id, device_id, captured_at, modified_at, media_type,
               latitude, longitude, observed_at, deleted_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $9)
             ON CONFLICT (library_scope, cloud_id) DO UPDATE SET
               device_id = EXCLUDED.device_id,
               captured_at = EXCLUDED.captured_at,
               modified_at = EXCLUDED.modified_at,
               media_type = EXCLUDED.media_type,
               latitude = EXCLUDED.latitude,
               longitude = EXCLUDED.longitude,
               observed_at = EXCLUDED.observed_at,
               deleted_at = NULL,
               updated_at = EXCLUDED.updated_at`,
            [
              batch.libraryScope,
              event.photo.cloudId,
              batch.deviceId,
              event.photo.capturedAt,
              event.photo.modifiedAt,
              event.photo.mediaType,
              event.photo.latitude ?? null,
              event.photo.longitude ?? null,
              batch.sentAt,
            ],
          )
        }

        await query(
          `INSERT INTO apple_photo_cursor (library_scope, device_id, cursor, updated_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (library_scope, device_id) DO UPDATE SET
             cursor = EXCLUDED.cursor,
             updated_at = EXCLUDED.updated_at`,
          [batch.libraryScope, batch.deviceId, required(batch.cursor, 'APPLE_PHOTO_CURSOR_REQUIRED'), batch.sentAt],
        )
        return { status: 'accepted', batchDigest: digest, eventCount: batch.events.length, cursor: batch.cursor }
      })
    },
  }
}
