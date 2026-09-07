import type { ContextObservation } from './universal-context.ts'

export interface PastJourneyCluster {
  id: string
  placeRef: string
  label: string
  coordinates: { latitude: number; longitude: number }
  memoryCount: number
  firstSeen?: string
  lastSeen?: string
  evidenceRefs: string[]
}

export interface PastJourneyProjection {
  clusters: PastJourneyCluster[]
  unlocatedMemoryCount: number
}

export type PastJourneyDisplayCluster = Omit<PastJourneyCluster, 'evidenceRefs' | 'placeRef'>
export interface PastJourneyDisplayProjection {
  clusters: PastJourneyDisplayCluster[]
  unlocatedMemoryCount: number
}

export interface ProjectPastJourneyInput {
  observations: ContextObservation[]
  subjectId?: string
}
function validCoordinates(value: unknown): value is { latitude: number; longitude: number } {
  if (!value || typeof value !== 'object') return false
  const point = value as { latitude?: unknown; longitude?: unknown }
  return typeof point.latitude === 'number' && Number.isFinite(point.latitude)
    && point.latitude >= -90 && point.latitude <= 90
    && typeof point.longitude === 'number' && Number.isFinite(point.longitude)
    && point.longitude >= -180 && point.longitude <= 180
}

function isSubjectMemory(observation: ContextObservation, subjectId?: string): boolean {
  if (observation.kind !== 'memory' || observation.evidenceState !== 'confirmed') return false
  if (!subjectId) return true
  return observation.sixW1H.who?.personIds.includes(subjectId) ?? false
}

function observedMemoryTime(observation: ContextObservation): string | undefined {
  const value = observation.sixW1H.when?.start
  return value && Number.isFinite(Date.parse(value)) ? value : undefined
}

function sortedTimes(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value)).sort((a, b) => Date.parse(a) - Date.parse(b))
}

export function projectPastJourney(input: ProjectPastJourneyInput): PastJourneyProjection {
  const memories = input.observations.filter((item) => isSubjectMemory(item, input.subjectId))
  const grouped = new Map<string, ContextObservation[]>()
  let unlocatedMemoryCount = 0

  for (const memory of memories) {
    const where = memory.sixW1H.where
    if (!where?.placeRef || !where.label || !validCoordinates(where.coordinates)) {
      unlocatedMemoryCount += 1
      continue
    }
    const list = grouped.get(where.placeRef) ?? []
    list.push(memory)
    grouped.set(where.placeRef, list)
  }

  const clusters = [...grouped.entries()].map(([placeRef, items]) => {
    const first = items[0].sixW1H.where!
    const times = sortedTimes(items.map(observedMemoryTime))
    const evidenceRefs = [...new Set(items.flatMap((item) => item.evidenceRefs))]
    return {
      id: `journey:${placeRef}`,
      placeRef,
      label: first.label!,
      coordinates: first.coordinates!,
      memoryCount: items.length,
      ...(times.length ? { firstSeen: times[0], lastSeen: times[times.length - 1] } : {}),
      evidenceRefs,
    }
  })

  clusters.sort((a, b) => Date.parse(b.lastSeen ?? '') - Date.parse(a.lastSeen ?? ''))
  return { clusters, unlocatedMemoryCount }
}

export function pastJourneyForDisplay(journey: PastJourneyProjection): PastJourneyDisplayProjection {
  return {
    clusters: journey.clusters.map((cluster, index) => ({
      id: `journey-cluster-${index + 1}`,
      label: cluster.label,
      coordinates: { ...cluster.coordinates },
      memoryCount: cluster.memoryCount,
      ...(cluster.firstSeen ? { firstSeen: cluster.firstSeen } : {}),
      ...(cluster.lastSeen ? { lastSeen: cluster.lastSeen } : {}),
    })),
    unlocatedMemoryCount: journey.unlocatedMemoryCount,
  }
}
