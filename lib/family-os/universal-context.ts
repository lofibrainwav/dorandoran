import type { EvidenceState, JobMode } from './contracts.ts'

export type SixW1HKey = 'who' | 'what' | 'when' | 'where' | 'why' | 'how'
export type FamilyLensPillar = 'jin' | 'seon' | 'mi' | 'in' | 'hyo'
export type ConnectionStatus = 'connected' | 'partial' | 'expired' | 'revoked' | 'unknown'
export type CapabilityOperation = 'read' | 'search' | 'observe' | 'draft' | 'write' | 'send' | 'share' | 'execute'

export interface CapabilityGrant {
  id: string
  operations: CapabilityOperation[]
  authorityRef?: string
}

export interface ProviderConnection {
  id: string
  providerKey: string
  accountRef: string
  status: ConnectionStatus
  capabilities: CapabilityGrant[]
}

export interface ConnectionRegistry {
  connections: ProviderConnection[]
}

export interface CapabilitySource {
  connectionId: string
  providerKey: string
  accountRef: string
  capability: CapabilityGrant
}

export interface SixW1HEnvelope {
  who?: { personIds: string[] }
  what?: { label: string; ref?: string }
  when?: { start?: string; end?: string; timeZone?: string }
  where?: { placeRef?: string; label?: string; coordinates?: { latitude: number; longitude: number } }
  why?: { goalRef?: string; summary?: string }
  how?: { mode?: JobMode; routeRef?: string; handoffRef?: string; summary?: string }
}

export interface FamilyLensObservation {
  pillar: FamilyLensPillar
  state: EvidenceState
  evidenceRefs: string[]
  note?: string
}

export interface ContinuityEnvelope {
  recordedAt: string
  validFrom?: string
  validTo?: string
  priorObservationRef?: string
}

export interface ContextObservationInput {
  id: string
  kind: string
  sixW1H: SixW1HEnvelope
  sourceRef: string
  observedAt: string
  evidenceState: EvidenceState
  evidenceRefs: string[]
  authorityRef?: string
  lens?: FamilyLensObservation[]
  continuity: ContinuityEnvelope
}

export interface ContextObservation extends ContextObservationInput {
  adapterId: string
}


export interface ContextAdapter<TInput = unknown> {
  id: string
  inputKind: string
  normalize: (input: TInput) => ContextObservationInput[]
}

export interface AdapterRegistry {
  adapters: Array<ContextAdapter<unknown>>
}

export interface PresenceObservation {
  state: 'confirmed_live' | 'scheduled' | 'last_known' | 'unknown'
  placeRef?: string
  observedAt: string
  evidenceRefs: string[]
}

export interface ContextStoryInput {
  subjectIds: string[]
  now?: string
  next?: string
  change?: string
  outcome?: string
  evidenceRefs: string[]
}

export interface ContextStory {
  subjectIds: string[]
  stages: Array<{ key: 'now' | 'next' | 'change' | 'outcome'; text: string }>
  evidenceRefs: string[]
}


export function createAdapterRegistry(adapters: Array<ContextAdapter<unknown>>): AdapterRegistry {
  return { adapters: [...adapters] }
}

export function findAdapter(registry: AdapterRegistry, inputKind: string): ContextAdapter<unknown> | undefined {
  return registry.adapters.find((adapter) => adapter.inputKind === inputKind)
}

export function sortObservationsByContinuity(observations: ContextObservation[]): ContextObservation[] {
  return [...observations].sort((left, right) =>
    Date.parse(left.continuity.recordedAt) - Date.parse(right.continuity.recordedAt),
  )
}

export function createConnectionRegistry(connections: ProviderConnection[]): ConnectionRegistry {
  return { connections: [...connections] }
}

export function findCapabilitySources(registry: ConnectionRegistry, capabilityId: string): CapabilitySource[] {
  return registry.connections.flatMap((connection) => {
    if (connection.status !== 'connected') return []
    const capability = connection.capabilities.find((item) => item.id === capabilityId)
    if (!capability) return []
    return [{
      connectionId: connection.id,
      providerKey: connection.providerKey,
      accountRef: connection.accountRef,
      capability,
    }]
  })
}

export function normalizeAdapterOutput(adapterId: string, observations: ContextObservationInput[]): ContextObservation[] {
  return observations.map((observation) => ({ ...observation, adapterId }))
}

export function resolvePresenceLabel(observation: PresenceObservation): 'Live' | 'Scheduled' | 'Last known' | 'Unknown' {
  if (observation.state === 'confirmed_live') return 'Live'
  if (observation.state === 'scheduled') return 'Scheduled'
  if (observation.state === 'last_known') return 'Last known'
  return 'Unknown'
}

export function projectContextStory(input: ContextStoryInput): ContextStory {
  const stages: ContextStory['stages'] = []
  if (input.now) stages.push({ key: 'now', text: input.now })
  if (input.next) stages.push({ key: 'next', text: input.next })
  if (input.change) stages.push({ key: 'change', text: input.change })
  if (input.outcome) stages.push({ key: 'outcome', text: input.outcome })
  return { subjectIds: [...input.subjectIds], stages, evidenceRefs: [...input.evidenceRefs] }
}
