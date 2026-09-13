export type ResearchContentKind = 'web' | 'youtube'
export type ResearchEvidenceState = 'confirmed' | 'partial' | 'unknown' | 'stale' | 'failed'

export interface ResearchObservationInput {
  id: string
  fingerprint: string
  sourceUrl: string
  title: string
  summary: string
  observedAt: string
  observer: string
  contentKind: ResearchContentKind
  evidenceState: ResearchEvidenceState
  unknowns?: string[]
  evidenceRefs?: string[]
}

export interface ResearchObservation extends ResearchObservationInput {
  unknowns: string[]
  evidenceRefs: string[]
}

const CONTENT_KINDS = new Set<ResearchContentKind>(['web', 'youtube'])
const EVIDENCE_STATES = new Set<ResearchEvidenceState>(['confirmed', 'partial', 'unknown', 'stale', 'failed'])

function requiredString(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code)
  return value.trim()
}

function validObservedAt(value: string): boolean {
  return Number.isFinite(Date.parse(value))
}

function validSourceUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function boundedStrings(value: unknown, limit: number, code: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error(code)
  return value.flatMap((item) => {
    if (typeof item !== 'string' || !item.trim()) return []
    return [item.trim().slice(0, 500)]
  }).slice(0, limit)
}

export function normalizeResearchObservation(input: ResearchObservationInput): ResearchObservation {
  const id = requiredString(input.id, 'RESEARCH_OBSERVATION_ID_REQUIRED')
  const fingerprint = requiredString(input.fingerprint, 'RESEARCH_OBSERVATION_FINGERPRINT_REQUIRED')
  const sourceUrl = requiredString(input.sourceUrl, 'RESEARCH_OBSERVATION_SOURCE_URL_REQUIRED')
  if (!validSourceUrl(sourceUrl)) throw new Error('RESEARCH_OBSERVATION_SOURCE_URL_INVALID')
  const title = requiredString(input.title, 'RESEARCH_OBSERVATION_TITLE_REQUIRED').slice(0, 300)
  const summary = requiredString(input.summary, 'RESEARCH_OBSERVATION_SUMMARY_REQUIRED').slice(0, 4000)
  const observedAt = requiredString(input.observedAt, 'RESEARCH_OBSERVATION_OBSERVED_AT_REQUIRED')
  if (!validObservedAt(observedAt)) throw new Error('RESEARCH_OBSERVATION_OBSERVED_AT_INVALID')
  const observer = requiredString(input.observer, 'RESEARCH_OBSERVATION_OBSERVER_REQUIRED').slice(0, 120)
  if (!CONTENT_KINDS.has(input.contentKind)) throw new Error('RESEARCH_OBSERVATION_CONTENT_KIND_INVALID')
  if (!EVIDENCE_STATES.has(input.evidenceState)) throw new Error('RESEARCH_OBSERVATION_EVIDENCE_STATE_INVALID')
  return {
    id, fingerprint, sourceUrl, title, summary, observedAt, observer,
    contentKind: input.contentKind, evidenceState: input.evidenceState,
    unknowns: boundedStrings(input.unknowns, 20, 'RESEARCH_OBSERVATION_UNKNOWNS_INVALID'),
    evidenceRefs: boundedStrings(input.evidenceRefs, 20, 'RESEARCH_OBSERVATION_EVIDENCE_REFS_INVALID'),
  }
}

export function observationFingerprint(input: Pick<ResearchObservation, 'sourceUrl' | 'summary' | 'contentKind'>): string {
  return `${input.contentKind}|${input.sourceUrl}|${input.summary}`
}
