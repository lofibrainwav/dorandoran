import { pastJourneyForDisplay, projectPastJourney, type PastJourneyDisplayCluster } from './past-journey.ts'
import { projectPastJourneyStories, type PastJourneyStoryCard } from './past-journey-story.ts'
import { groupPastJourneyTrips } from './trip-grouping.ts'
import type { ContextObservation } from './universal-context.ts'

export interface PastJourneyExperienceProjection {
  clusters: PastJourneyDisplayCluster[]
  stories: PastJourneyStoryCard[]
  unlocatedMemoryCount: number
  ungroupedMemoryCount: number
}

export interface ProjectPastJourneyExperienceInput {
  observations: ContextObservation[]
  subjectId?: string
  maxGapMs: number
}

export function projectPastJourneyExperience(input: ProjectPastJourneyExperienceInput): PastJourneyExperienceProjection {
  const journey = projectPastJourney({ observations: input.observations, subjectId: input.subjectId })
  const grouping = groupPastJourneyTrips({
    observations: input.observations,
    subjectId: input.subjectId,
    maxGapMs: input.maxGapMs,
  })
  const story = projectPastJourneyStories({
    grouping,
    observations: input.observations,
    subjectId: input.subjectId,
  })
  const display = pastJourneyForDisplay(journey)
  return {
    clusters: display.clusters,
    stories: story.stories,
    unlocatedMemoryCount: display.unlocatedMemoryCount,
    ungroupedMemoryCount: story.ungroupedMemoryCount,
  }
}
