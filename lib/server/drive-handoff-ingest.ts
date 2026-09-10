import { proposeCandidate, type CaptureEvent } from '../family-os/lifecycle.ts'
import type { HandoffIntake } from '../family-os/drive-handoff-intake.ts'
import type { ArtifactObservationInput } from '../family-os/artifact-registry.ts'
import type { JobMode, Opportunity } from '../family-os/contracts.ts'
import type { CandidateRecord } from './lifecycle-store.ts'

export interface DriveHandoffIngestInput {
  lane: string
  fileId: string
  intake: HandoffIntake
  now: string
}

export type DriveHandoffIngestOutcome = 'inserted' | 'duplicate'

export interface DriveHandoffIngestStore {
  ingest(input: DriveHandoffIngestInput): Promise<DriveHandoffIngestOutcome>
}

export type DriveHandoffQueryResult = { rows: Record<string, unknown>[]; rowCount: number | null }
export type DriveHandoffQuery = (text: string, params?: unknown[]) => Promise<DriveHandoffQueryResult>
export type DriveHandoffTransaction = <T>(fn: (query: DriveHandoffQuery) => Promise<T>) => Promise<T>

function clean(value: string, code: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(code)
  return trimmed
}

function artifactValue(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code)
  return value.trim()
}

function scopedId(lane: string, kind: string, sourceId: string): string {
  return `drive:${clean(lane, 'DRIVE_HANDOFF_LANE_REQUIRED')}:${kind}:${clean(sourceId, 'DRIVE_HANDOFF_EVENT_REQUIRED')}`
}

function projectCapture(input: DriveHandoffIngestInput): CaptureEvent {
  const capture = input.intake.capture
  return {
    ...capture,
    id: scopedId(input.lane, 'capture', capture.id),
    capturedBy: 'drive-outbox',
    evidenceRefs: [...new Set([...capture.evidenceRefs, `drive:file:${clean(input.fileId, 'DRIVE_HANDOFF_FILE_REQUIRED')}`])].sort(),
  }
}

function projectCandidate(input: DriveHandoffIngestInput, capture: CaptureEvent): CandidateRecord | null {
  const proposal = input.intake.candidateProposal
  if (!input.intake.proposeCandidate || !proposal) return null

  const opportunity: Opportunity = proposeCandidate({
    capture,
    proposedBy: 'drive-outbox',
    id: scopedId(input.lane, 'candidate', input.intake.capture.id),
    mode: proposal.mode as JobMode,
    estimatedMinutes: proposal.estimatedMinutes,
    priority: proposal.priority,
  })
  return {
    id: opportunity.id,
    personId: capture.personId,
    privacyScope: capture.privacyScope,
    sourceCaptureId: capture.id,
    proposedBy: 'drive-outbox',
    opportunity,
    version: 1,
    createdAt: input.now,
    updatedAt: input.now,
  }
}

function projectArtifact(input: DriveHandoffIngestInput): ArtifactObservationInput | null {
  const artifact = input.intake.artifact
  if (!artifact) return null
  return {
    id: artifactValue(artifact.id, 'DRIVE_HANDOFF_ARTIFACT_ID_REQUIRED'),
    kind: artifactValue(artifact.kind, 'DRIVE_HANDOFF_ARTIFACT_KIND_REQUIRED'),
    digest: artifactValue(artifact.digest, 'DRIVE_HANDOFF_ARTIFACT_DIGEST_REQUIRED'),
    observedAt: artifactValue(artifact.observedAt, 'DRIVE_HANDOFF_ARTIFACT_TIME_REQUIRED'),
    state: artifactValue(artifact.state, 'DRIVE_HANDOFF_ARTIFACT_STATE_REQUIRED'),
    provenance: artifact.provenance,
  }
}

/**
 * Persists a Drive handoff as Capture and, only when the handoff explicitly supplied proposal
 * details, Candidate. This boundary never writes a decision or Task. The ingest ledger makes
 * retries idempotent and is committed in the same transaction as the lifecycle rows.
 */
export function createPostgresDriveHandoffIngestStore(input: {
  query: DriveHandoffQuery
  transaction: DriveHandoffTransaction
}): DriveHandoffIngestStore {
  return {
    async ingest(ingestInput): Promise<DriveHandoffIngestOutcome> {
      const capture = projectCapture(ingestInput)
      const candidate = projectCandidate(ingestInput, capture)
      const artifact = projectArtifact(ingestInput)
      return input.transaction(async (query) => {
        const ledger = await query(
          `INSERT INTO drive_handoff_ingest (lane, file_id, event_id, capture_id, candidate_id, ingested_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (lane, event_id) DO NOTHING
           RETURNING event_id`,
          [ingestInput.lane, ingestInput.fileId, ingestInput.intake.capture.id, capture.id, candidate?.id ?? null, ingestInput.now],
        )
        if (!ledger.rowCount) return 'duplicate'

        await query(
          `INSERT INTO lifecycle_capture
            (id, person_id, privacy_scope, kind, stated_text, source, occurred_at, captured_at, captured_by, evidence_refs, unknowns)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [capture.id, capture.personId, capture.privacyScope, capture.kind, capture.statedText, capture.source,
            capture.occurredAt, capture.capturedAt, capture.capturedBy, JSON.stringify(capture.evidenceRefs), JSON.stringify(capture.unknowns)],
        )
        if (candidate) {
          await query(
            `INSERT INTO lifecycle_candidate
              (id, person_id, privacy_scope, source_capture_id, proposed_by, opportunity, decision, version, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9)`,
            [candidate.id, candidate.personId, candidate.privacyScope, candidate.sourceCaptureId, candidate.proposedBy,
              JSON.stringify(candidate.opportunity), candidate.version, candidate.createdAt, candidate.updatedAt],
          )
        }
        if (artifact) {
          await query(
            `INSERT INTO drive_artifact_observation
              (lane, event_id, privacy_scope, artifact_id, kind, digest, observed_at, state, provenance, recorded_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
            [ingestInput.lane, ingestInput.intake.capture.id, ingestInput.intake.capture.privacyScope, artifact.id,
              artifact.kind, artifact.digest, artifact.observedAt, artifact.state,
              JSON.stringify(artifact.provenance ?? {}), ingestInput.now],
          )
        }
        return 'inserted'
      })
    },
  }
}

export function createMemoryDriveHandoffIngestStore(): DriveHandoffIngestStore {
  const eventIds = new Set<string>()
  const captures: CaptureEvent[] = []
  const candidates: CandidateRecord[] = []
  return {
    async ingest(input) {
      const key = `${input.lane}:${input.intake.capture.id}`
      if (eventIds.has(key)) return 'duplicate'
      eventIds.add(key)
      const capture = projectCapture(input)
      captures.push(capture)
      const candidate = projectCandidate(input, capture)
      if (candidate) candidates.push(candidate)
      return 'inserted'
    },
  }
}
