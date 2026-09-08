import type { ContextObservation } from './universal-context.ts'

export interface PastJourneyTripGroup {
  id: string
  start: string
  end: string
  memoryCount: number
  placeRefs: string[]
  evidenceRefs: string[]
}

export interface PastJourneyTripGrouping {
  groups: PastJourneyTripGroup[]
  ungroupedMemoryCount: number
}

export interface GroupPastJourneyTripsInput {
  observations: ContextObservation[]
  subjectId?: string
  maxGapMs: number
}

function isEligibleMemory(observation: ContextObservation, subjectId?: string): boolean {
  if (observation.kind !== 'memory' || observation.evidenceState !== 'confirmed') return false
  if (!subjectId) return true
  return observation.sixW1H.who?.personIds.includes(subjectId) ?? false
}

function validStart(observation: ContextObservation): string | undefined {
  const value = observation.sixW1H.when?.start
  return value && Number.isFinite(Date.parse(value)) ? value : undefined
}

function buildGroup(items: ContextObservation[], index: number): PastJourneyTripGroup {
  const starts = items.map((item) => validStart(item)!)
  const placeRefs = [...new Set(items.flatMap((item) => {
    const ref = item.sixW1H.where?.placeRef
    return ref ? [ref] : []
  }))]
  const evidenceRefs = [...new Set(items.flatMap((item) => item.evidenceRefs))]
  return {
    id: `trip-group-${index + 1}`,
    start: starts[0],
    end: starts[starts.length - 1],
    memoryCount: items.length,
    placeRefs,
    evidenceRefs,
  }
}

export function groupPastJourneyTrips(input: GroupPastJourneyTripsInput): PastJourneyTripGrouping {
  if (!Number.isFinite(input.maxGapMs) || input.maxGapMs <= 0) {
    throw new Error('TRIP_GROUPING_MAX_GAP_INVALID')
  }

  const eligible = input.observations.filter((item) => isEligibleMemory(item, input.subjectId))
  const timed = eligible.filter((item) => Boolean(validStart(item)))
    .sort((a, b) => Date.parse(validStart(a)!) - Date.parse(validStart(b)!))
  const ungroupedMemoryCount = eligible.length - timed.length
  if (!timed.length) return { groups: [], ungroupedMemoryCount }

  const partitions: ContextObservation[][] = [[timed[0]]]
  for (const current of timed.slice(1)) {
    const group = partitions[partitions.length - 1]
    const previous = group[group.length - 1]
    const gap = Date.parse(validStart(current)!) - Date.parse(validStart(previous)!)
    if (gap <= input.maxGapMs) group.push(current)
    else partitions.push([current])
  }

  return {
    groups: partitions.map(buildGroup),
    ungroupedMemoryCount,
  }
}
