import {
  normalizeAdapterOutput,
  photoMetadataAdapter,
  projectPastJourneyExperience,
  type ContextObservation,
  type PastJourneyExperienceProjection,
} from '../family-os/index.ts'
import { privateFamilySurfaceEnabled } from './private-family-surface.ts'
import {
  readSelectedApplePhotosMetadata,
  type SelectedApplePhotoMetadata,
} from './apple-photos-selection-transport.ts'

export type PrivatePhotoMetadataReader = (input: { limit: number }) => Promise<SelectedApplePhotoMetadata[]>

export interface PrivatePhotoJourneyResult {
  source: 'apple-photos-selection'
  sourceHealth: 'green' | 'failure'
  selectedCount: number
  experience: PastJourneyExperienceProjection
}

function sourceEnabled(env: Record<string, string | undefined>): boolean {
  return privateFamilySurfaceEnabled(env) && env.APPLE_PHOTOS_SELECTION_SOURCE === '1'
}

function emptyExperience(maxGapMs: number): PastJourneyExperienceProjection {
  return projectPastJourneyExperience({ observations: [], maxGapMs })
}

export async function loadPrivatePhotoJourney(input: {
  env?: Record<string, string | undefined>
  observedAt: string
  maxGapMs: number
  limit?: number
  readMetadata?: PrivatePhotoMetadataReader
}): Promise<PrivatePhotoJourneyResult | null> {
  const env = input.env ?? process.env
  if (!sourceEnabled(env)) return null
  const readMetadata = input.readMetadata ?? readSelectedApplePhotosMetadata
  try {
    const records = await readMetadata({ limit: input.limit ?? 50 })
    const observations: ContextObservation[] = records.flatMap((record) => normalizeAdapterOutput(
      photoMetadataAdapter.id,
      photoMetadataAdapter.normalize({
        id: `apple-photo-memory:${record.id}`,
        sourceRef: `apple-photos:selection:${record.id}`,
        evidenceRef: `apple-photos-evidence:${record.id}`,
        observedAt: input.observedAt,
        capturedAt: record.capturedAt,
        ...(record.coordinates ? { place: { coordinates: record.coordinates } } : {}),
      }),
    ))
    return {
      source: 'apple-photos-selection',
      sourceHealth: 'green',
      selectedCount: records.length,
      experience: projectPastJourneyExperience({ observations, maxGapMs: input.maxGapMs }),
    }
  } catch {
    return {
      source: 'apple-photos-selection',
      sourceHealth: 'failure',
      selectedCount: 0,
      experience: emptyExperience(input.maxGapMs),
    }
  }
}
