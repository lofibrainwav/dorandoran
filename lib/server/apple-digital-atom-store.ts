import { createHash } from 'node:crypto'
import {
  canonicalAppleDigitalAtomBatch,
  parseAppleDigitalAtomBatch,
  type AppleDigitalAtomBatch,
} from '../family-os/apple-digital-atom.ts'

export type AppleDigitalAtomQueryResult = { rows: Record<string, unknown>[]; rowCount: number | null }
export type AppleDigitalAtomQuery = (text: string, params?: unknown[]) => Promise<AppleDigitalAtomQueryResult>
export type AppleDigitalAtomTransaction = <T>(run: (query: AppleDigitalAtomQuery) => Promise<T>) => Promise<T>

export interface AppleDigitalAtomIngestResult {
  status: 'accepted' | 'duplicate'
  batchDigest: string
  eventCount: number
  cursor: string
}

export function appleDigitalAtomBatchDigest(batch: AppleDigitalAtomBatch): string {
  return createHash('sha256').update(canonicalAppleDigitalAtomBatch(batch), 'utf8').digest('hex')
}

export function createPostgresAppleDigitalAtomStore(input: {
  transaction: AppleDigitalAtomTransaction
}): { ingest(value: unknown): Promise<AppleDigitalAtomIngestResult> } {
  return {
    async ingest(value) {
      const batch = parseAppleDigitalAtomBatch(value)
      if (!batch) throw new Error('APPLE_DIGITAL_ATOM_BATCH_INVALID')
      const digest = appleDigitalAtomBatchDigest(batch)
      return input.transaction(async (query) => {
        const receipt = await query(
          `INSERT INTO apple_digital_atom_receipt
             (source, device_id, batch_digest, cursor, received_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (source, device_id, batch_digest) DO NOTHING
           RETURNING batch_digest`,
          [batch.source, batch.deviceId, digest, batch.cursor, batch.sentAt],
        )
        if (!receipt.rowCount) return { status: 'duplicate', batchDigest: digest, eventCount: batch.events.length, cursor: batch.cursor }

        for (const event of batch.events) {
          await query(
            `INSERT INTO apple_digital_atom_metadata
              (source, device_id, event_id, operation, kind, occurred_at, metadata, observed_at, deleted_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $8)
             ON CONFLICT (source, device_id, event_id) DO UPDATE SET
               operation = EXCLUDED.operation,
               kind = EXCLUDED.kind,
               occurred_at = EXCLUDED.occurred_at,
               metadata = EXCLUDED.metadata,
               observed_at = EXCLUDED.observed_at,
               deleted_at = EXCLUDED.deleted_at,
               updated_at = EXCLUDED.updated_at`,
            [batch.source, batch.deviceId, event.eventId, event.operation, event.kind, event.occurredAt,
              JSON.stringify(event.metadata), batch.sentAt, event.operation === 'delete' ? batch.sentAt : null],
          )
        }

        await query(
          `INSERT INTO apple_digital_atom_cursor (source, device_id, cursor, updated_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (source, device_id) DO UPDATE SET
             cursor = EXCLUDED.cursor,
             updated_at = EXCLUDED.updated_at`,
          [batch.source, batch.deviceId, batch.cursor, batch.sentAt],
        )
        return { status: 'accepted', batchDigest: digest, eventCount: batch.events.length, cursor: batch.cursor }
      })
    },
  }
}
