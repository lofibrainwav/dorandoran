import type { DriveOutboxRunResult } from './drive-outbox-run.ts'

export interface DriveArtifactSummary {
  id: string
  kind: string
  observedAt: string
  state: string
  sourceSystem: string
  domain: string
}

export interface DriveArtifactProjection {
  artifacts: DriveArtifactSummary[]
  accepted: number
  duplicate: number
  rejected: number
  skipped: number
  unreadable: number
}

/**
 * Drive intake 결과를 가족 운영판에 노출할 최소 정보로 줄인다.
 * 원문(statedText), digest, 인증정보, 전체 provenance는 브라우저로 보내지 않는다.
 */
export function projectDriveArtifacts(result: DriveOutboxRunResult): DriveArtifactProjection {
  const artifacts = result.entries.flatMap((entry) => {
    if (entry.outcome !== 'accepted' || entry.intake.artifact === null) return []
    return [{
      id: String(entry.intake.artifact.id),
      kind: String(entry.intake.artifact.kind),
      observedAt: String(entry.intake.artifact.observedAt),
      state: String(entry.intake.artifact.state),
      sourceSystem: entry.intake.provenance.sourceSystem,
      domain: entry.intake.provenance.domain,
    }]
  }).sort((a, b) => b.observedAt.localeCompare(a.observedAt) || a.id.localeCompare(b.id))

  return {
    artifacts,
    accepted: result.entries.filter((entry) => entry.outcome === 'accepted').length,
    duplicate: result.entries.filter((entry) => entry.outcome === 'duplicate').length,
    rejected: result.entries.filter((entry) => entry.outcome === 'rejected').length,
    skipped: result.skipped.length,
    unreadable: result.unreadable.length,
  }
}
