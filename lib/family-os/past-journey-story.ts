import type { PastJourneyTripGrouping } from './trip-grouping.ts'
import type { ContextObservation } from './universal-context.ts'

export interface PastJourneyStoryCard {
  id: string
  start: string
  end: string
  memoryCount: number
  places: string[]
  summary: string
}

export interface PastJourneyStoryProjection {
  stories: PastJourneyStoryCard[]
  ungroupedMemoryCount: number
}

export interface ProjectPastJourneyStoriesInput {
  grouping: PastJourneyTripGrouping
  observations: ContextObservation[]
  subjectId?: string
}

function isEligibleMemory(observation: ContextObservation, subjectId?: string): boolean {
  if (observation.kind !== 'memory' || observation.evidenceState !== 'confirmed') return false
  if (!subjectId) return true
  return observation.sixW1H.who?.personIds.includes(subjectId) ?? false
}

function startMs(observation: ContextObservation): number {
  const value = observation.sixW1H.when?.start
  return value ? Date.parse(value) : Number.NaN
}

function explicitPlaces(observations: ContextObservation[]): string[] {
  const ordered = [...observations].sort((a, b) => startMs(a) - startMs(b))
  const labels = ordered.flatMap((observation) => {
    const label = observation.sixW1H.where?.label
    return typeof label === 'string' && label.trim() ? [label.trim()] : []
  })
  return [...new Set(labels)]
}

function storySummary(memoryCount: number, places: string[]): string {
  const count = `${memoryCount} ${memoryCount === 1 ? 'memory' : 'memories'}`
  return places.length ? `${count} · ${places.join(', ')}` : count
}

export function projectPastJourneyStories(input: ProjectPastJourneyStoriesInput): PastJourneyStoryProjection {
  const eligible = input.observations.filter((item) => isEligibleMemory(item, input.subjectId))
  const stories = input.grouping.groups.map((group, index) => {
    const groupEvidence = new Set(group.evidenceRefs)
    const matched = eligible.filter((observation) => observation.evidenceRefs.some((ref) => groupEvidence.has(ref)))
    const places = explicitPlaces(matched)
    return {
      id: `past-story-${index + 1}`,
      start: group.start,
      end: group.end,
      memoryCount: group.memoryCount,
      places,
      summary: storySummary(group.memoryCount, places),
    }
  })
  return { stories, ungroupedMemoryCount: input.grouping.ungroupedMemoryCount }
}
