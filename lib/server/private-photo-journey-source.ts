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
import { readApplePhotosAlbumMetadata } from './apple-photos-album-transport.ts'

export type PrivatePhotoMetadataReader = (input: { limit: number }) => Promise<SelectedApplePhotoMetadata[]>
export type PrivatePhotoAlbumReader = (input: { albumName: string; limit: number }) => Promise<SelectedApplePhotoMetadata[]>

export interface PrivatePhotoJourneyResult {
  source: 'apple-photos-selection' | 'apple-photos-album'
  sourceHealth: 'green' | 'failure'
  selectedCount: number
  experience: PastJourneyExperienceProjection
}

type PhotoSourcePlan = { source: 'apple-photos-selection' } | { source: 'apple-photos-album'; albumName: string }

function sourcePlan(env: Record<string, string | undefined>): PhotoSourcePlan | null {
  if (!privateFamilySurfaceEnabled(env)) return null
  const albumName = env.APPLE_PHOTOS_ALBUM_NAME?.trim()
  if (albumName) return { source: 'apple-photos-album', albumName }
  if (env.APPLE_PHOTOS_SELECTION_SOURCE === '1') return { source: 'apple-photos-selection' }
  return null
}

function emptyExperience(maxGapMs: number): PastJourneyExperienceProjection {
  return projectPastJourneyExperience({ observations: [], maxGapMs })
}

function recordsToObservations(
  records: SelectedApplePhotoMetadata[],
  observedAt: string,
  source: PhotoSourcePlan['source'],
): ContextObservation[] {
  return records.flatMap((record) => normalizeAdapterOutput(
    photoMetadataAdapter.id,
    photoMetadataAdapter.normalize({
      id: `apple-photo-memory:${record.id}`,
      sourceRef: `${source}:${record.id}`,
      evidenceRef: `apple-photos-evidence:${record.id}`,
      observedAt,
      capturedAt: record.capturedAt,
      ...(record.coordinates ? { place: { coordinates: record.coordinates } } : {}),
    }),
  ))
}

export async function loadPrivatePhotoJourney(input: {
  env?: Record<string, string | undefined>
  observedAt: string
  maxGapMs: number
  limit?: number
  readMetadata?: PrivatePhotoMetadataReader
  readAlbumMetadata?: PrivatePhotoAlbumReader
}): Promise<PrivatePhotoJourneyResult | null> {
  const env = input.env ?? process.env
  const plan = sourcePlan(env)
  if (!plan) return null
  const limit = input.limit ?? 50
  try {
    const records = plan.source === 'apple-photos-album'
      ? await (input.readAlbumMetadata ?? readApplePhotosAlbumMetadata)({ albumName: plan.albumName, limit })
      : await (input.readMetadata ?? readSelectedApplePhotosMetadata)({ limit })
    const observations = recordsToObservations(records, input.observedAt, plan.source)
    return {
      source: plan.source,
      sourceHealth: 'green',
      selectedCount: records.length,
      experience: projectPastJourneyExperience({ observations, maxGapMs: input.maxGapMs }),
    }
  } catch {
    return {
      source: plan.source,
      sourceHealth: 'failure',
      selectedCount: 0,
      experience: emptyExperience(input.maxGapMs),
    }
  }
}
