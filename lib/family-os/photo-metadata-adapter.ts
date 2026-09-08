import type { ContextAdapter, ContextObservationInput, SixW1HEnvelope } from './universal-context.ts'

export interface PhotoMetadataInput {
  id?: unknown
  sourceRef?: unknown
  evidenceRef?: unknown
  observedAt?: unknown
  capturedAt?: unknown
  subjectIds?: unknown
  place?: unknown
  [key: string]: unknown
}

function requiredString(value: unknown, code: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  throw new Error(code)
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Date.parse(value))
}

function validCoordinates(value: unknown): { latitude: number; longitude: number } | undefined {
  if (!value || typeof value !== 'object') return undefined
  const point = value as { latitude?: unknown; longitude?: unknown }
  if (typeof point.latitude !== 'number' || !Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90) return undefined
  if (typeof point.longitude !== 'number' || !Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180) return undefined
  return { latitude: point.latitude, longitude: point.longitude }
}
function normalizePlace(value: unknown): SixW1HEnvelope['where'] | undefined {
  if (!value || typeof value !== 'object') return undefined
  const place = value as { placeRef?: unknown; label?: unknown; coordinates?: unknown }
  const placeRef = optionalString(place.placeRef)
  const label = optionalString(place.label)
  const coordinates = validCoordinates(place.coordinates)
  if (!placeRef && !label && !coordinates) return undefined
  return {
    ...(placeRef ? { placeRef } : {}),
    ...(label ? { label } : {}),
    ...(coordinates ? { coordinates } : {}),
  }
}

function normalizeSubjectIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.flatMap((item) => {
    const normalized = optionalString(item)
    return normalized ? [normalized] : []
  }))]
}

function normalizePhotoMetadata(input: PhotoMetadataInput): ContextObservationInput[] {
  const id = requiredString(input.id, 'PHOTO_METADATA_ID_REQUIRED')
  const sourceRef = requiredString(input.sourceRef, 'PHOTO_METADATA_SOURCE_REF_REQUIRED')
  const evidenceRef = requiredString(input.evidenceRef, 'PHOTO_METADATA_EVIDENCE_REF_REQUIRED')
  const observedAt = requiredString(input.observedAt, 'PHOTO_METADATA_OBSERVED_AT_REQUIRED')
  if (!validDate(observedAt)) throw new Error('PHOTO_METADATA_OBSERVED_AT_INVALID')

  const subjectIds = normalizeSubjectIds(input.subjectIds)
  const when = validDate(input.capturedAt) ? { start: input.capturedAt.trim() } : undefined
  const where = normalizePlace(input.place)
  const sixW1H: SixW1HEnvelope = {
    ...(subjectIds.length ? { who: { personIds: subjectIds } } : {}),
    ...(when ? { when } : {}),
    ...(where ? { where } : {}),
  }

  return [{
    id, kind: 'memory', sixW1H, sourceRef, observedAt,
    evidenceState: 'confirmed', evidenceRefs: [evidenceRef],
    continuity: { recordedAt: observedAt },
  }]
}

export const photoMetadataAdapter: ContextAdapter<PhotoMetadataInput> = {
  id: 'family.photo-metadata.v1',
  inputKind: 'photo.metadata',
  normalize: normalizePhotoMetadata,
}
