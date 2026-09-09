import type { EvidenceState } from './contracts.ts'

export type ArtifactRegistryState = EvidenceState | 'conflict'

export interface ArtifactProvenanceInput {
  sourceRef?: unknown
  evidenceRefs?: unknown
}

export interface ArtifactObservationInput {
  id?: unknown
  kind?: unknown
  digest?: unknown
  observedAt?: unknown
  state?: unknown
  provenance?: ArtifactProvenanceInput
  [key: string]: unknown
}

export interface ArtifactRecord {
  id: string
  kind: string
  digests: string[]
  observedAt: string
  state: ArtifactRegistryState
  provenance: {
    sourceRefs: string[]
    evidenceRefs: string[]
  }
}

export interface ArtifactRegistry {
  version: 1
  artifacts: ArtifactRecord[]
  conflicts: string[]
}

export type ArtifactReconcileStatus = 'added' | 'updated' | 'unchanged' | 'stale' | 'conflict'

export interface ArtifactReconcileEntry {
  id: string
  kind: string
  status: ArtifactReconcileStatus
  state: ArtifactRegistryState
}

export interface ArtifactReconcileResult {
  version: 1
  cutoff: string
  now: string
  entries: ArtifactReconcileEntry[]
}

export interface DailyArtifactCapsule {
  version: 1
  date: string
  counts: {
    total: number
    confirmed: number
    unknown: number
    stale: number
    contradicted: number
    inferred: number
    conflict: number
  }
  artifacts: Array<{ id: string; kind: string; state: ArtifactRegistryState }>
}

const VALID_STATES = new Set<EvidenceState>(['confirmed', 'unknown', 'stale', 'contradicted', 'inferred'])

function requiredString(value: unknown, code: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  throw new Error(code)
}

// Drive 계약: 유효한 digest 가 없으면 Artifact Registry 진입 금지. 부재(REQUIRED)와 무효(INVALID)는
// 다른 사건이라 코드를 나눈다 — 전자는 "해시를 붙여라", 후자는 "붙인 해시가 형식에 안 맞는다".
// 호출자를 믿지 않고 여기서도 본다: 계약이 금지 주체로 지목한 것이 registry 자신이다.
const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/

function artifactDigest(value: unknown): string {
  const text = requiredString(value, 'ARTIFACT_DIGEST_REQUIRED')
  if (!SHA256_DIGEST_PATTERN.test(text)) throw new Error('ARTIFACT_DIGEST_INVALID')
  return text
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Date.parse(value))
}

function timestamp(value: unknown, code: string): string {
  if (!validTimestamp(value)) throw new Error(code)
  return value.trim()
}

function state(value: unknown): EvidenceState {
  if (typeof value === 'string' && VALID_STATES.has(value as EvidenceState)) return value as EvidenceState
  throw new Error('ARTIFACT_STATE_INVALID')
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.flatMap((item) => typeof item === 'string' && item.trim() ? [item.trim()] : []))].sort()
}

function normalize(input: ArtifactObservationInput): ArtifactObservationInput & {
  id: string; kind: string; digest: string; observedAt: string; state: EvidenceState
} {
  return {
    ...input,
    id: requiredString(input.id, 'ARTIFACT_ID_REQUIRED'),
    kind: requiredString(input.kind, 'ARTIFACT_KIND_REQUIRED'),
    digest: artifactDigest(input.digest),
    observedAt: timestamp(input.observedAt, 'ARTIFACT_OBSERVED_AT_INVALID'),
    state: state(input.state),
  }
}

function stateRank(value: EvidenceState): number {
  return { unknown: 0, inferred: 1, stale: 2, confirmed: 3, contradicted: 4 }[value]
}

export function buildArtifactRegistry(inputs: readonly ArtifactObservationInput[]): ArtifactRegistry {
  const normalized = inputs.map(normalize)
  const byId = new Map<string, ArtifactRecord>()

  for (const input of normalized) {
    const existing = byId.get(input.id)
    const provenance = {
      sourceRefs: stringList(input.provenance?.sourceRef ? [input.provenance.sourceRef] : []),
      evidenceRefs: stringList(input.provenance?.evidenceRefs),
    }
    if (!existing) {
      byId.set(input.id, {
        id: input.id, kind: input.kind, digests: [input.digest], observedAt: input.observedAt,
        state: input.state, provenance,
      })
      continue
    }
    existing.digests = [...new Set([...existing.digests, input.digest])].sort()
    existing.provenance.sourceRefs = [...new Set([...existing.provenance.sourceRefs, ...provenance.sourceRefs])].sort()
    existing.provenance.evidenceRefs = [...new Set([...existing.provenance.evidenceRefs, ...provenance.evidenceRefs])].sort()
    if (input.observedAt > existing.observedAt) existing.observedAt = input.observedAt
    if (input.kind < existing.kind) existing.kind = input.kind
    if (stateRank(input.state) > stateRank(existing.state as EvidenceState)) existing.state = input.state
    if (existing.digests.length > 1) existing.state = 'conflict'
  }

  const artifacts = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
  return {
    version: 1,
    artifacts,
    conflicts: artifacts.filter((artifact) => artifact.state === 'conflict').map((artifact) => artifact.id),
  }
}

function registry(registryValue: ArtifactRegistry): ArtifactRegistry {
  if (!registryValue || registryValue.version !== 1 || !Array.isArray(registryValue.artifacts)) {
    throw new Error('ARTIFACT_REGISTRY_INVALID')
  }
  return registryValue
}

export function reconcileArtifactRegistries(input: {
  before: ArtifactRegistry
  after: ArtifactRegistry
  cutoff: string
  now: string
}): ArtifactReconcileResult {
  const before = registry(input.before)
  const after = registry(input.after)
  const cutoff = timestamp(input.cutoff, 'ARTIFACT_CUTOFF_INVALID')
  const now = timestamp(input.now, 'ARTIFACT_NOW_INVALID')
  if (Date.parse(cutoff) > Date.parse(now)) throw new Error('ARTIFACT_CUTOFF_AFTER_NOW')
  const beforeById = new Map(before.artifacts.map((artifact) => [artifact.id, artifact]))
  const entries = after.artifacts.map((artifact): ArtifactReconcileEntry => {
    const previous = beforeById.get(artifact.id)
    const status = artifact.state === 'conflict'
      ? 'conflict'
      : Date.parse(artifact.observedAt) < Date.parse(cutoff)
        ? 'stale'
        : !previous
          ? 'added'
          : previous.state === 'conflict' || previous.digests.join('\u0000') !== artifact.digests.join('\u0000')
            ? 'updated'
            : 'unchanged'
    return { id: artifact.id, kind: artifact.kind, status, state: artifact.state }
  })
  const afterIds = new Set(after.artifacts.map((artifact) => artifact.id))
  for (const previous of before.artifacts) {
    if (afterIds.has(previous.id)) continue
    entries.push({ id: previous.id, kind: previous.kind, status: 'stale', state: 'stale' })
  }
  entries.sort((a, b) => a.id.localeCompare(b.id))
  return { version: 1, cutoff, now, entries }
}

export function createDailyArtifactCapsule(input: {
  date: string
  registry: ArtifactRegistry
}): DailyArtifactCapsule {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(`${input.date}T00:00:00Z`))) {
    throw new Error('ARTIFACT_CAPSULE_DATE_INVALID')
  }
  const source = registry(input.registry)
  const artifacts = source.artifacts.map(({ id, kind, state: artifactState }) => ({ id, kind, state: artifactState }))
    .sort((a, b) => a.id.localeCompare(b.id))
  const counts = {
    total: artifacts.length,
    confirmed: artifacts.filter((artifact) => artifact.state === 'confirmed').length,
    unknown: artifacts.filter((artifact) => artifact.state === 'unknown').length,
    stale: artifacts.filter((artifact) => artifact.state === 'stale').length,
    contradicted: artifacts.filter((artifact) => artifact.state === 'contradicted').length,
    inferred: artifacts.filter((artifact) => artifact.state === 'inferred').length,
    conflict: artifacts.filter((artifact) => artifact.state === 'conflict').length,
  }
  return { version: 1, date: input.date, counts, artifacts }
}
