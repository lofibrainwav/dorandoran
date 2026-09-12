import type { RouteCoordinate, ScheduledPlaceIdentity } from './calendar-photo-route-context.ts'

export interface HouseholdPlaceResolver { resolve(label: string): ScheduledPlaceIdentity | undefined }

function validCoordinate(value: unknown): value is RouteCoordinate {
  if (!value || typeof value !== 'object') return false
  const point = value as { latitude?: unknown; longitude?: unknown }
  return typeof point.latitude === 'number' && Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90
    && typeof point.longitude === 'number' && Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180
}

function normalizeLabel(value: string): string { return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US') }

export function resolveHouseholdPlaceResolver(env: Record<string, string | undefined> = process.env): HouseholdPlaceResolver | null {
  const raw = env.DORANDORAN_PLACE_COORDINATES_JSON?.trim()
  if (!raw) return null
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error('INVALID_HOUSEHOLD_PLACE_MAP')
  const byLabel = new Map<string, ScheduledPlaceIdentity>()
  for (const item of parsed) {
    if (!item || typeof item !== 'object') throw new Error('INVALID_HOUSEHOLD_PLACE_MAP')
    const value = item as { label?: unknown; id?: unknown; coordinates?: unknown }
    if (typeof value.label !== 'string' || !value.label.trim() || typeof value.id !== 'string' || !value.id.trim() || !validCoordinate(value.coordinates)) throw new Error('INVALID_HOUSEHOLD_PLACE_MAP')
    const key = normalizeLabel(value.label)
    if (byLabel.has(key)) throw new Error('DUPLICATE_HOUSEHOLD_PLACE_LABEL')
    byLabel.set(key, { id: value.id.trim(), label: value.label.trim(), coordinates: { ...value.coordinates } })
  }
  return { resolve: (label) => byLabel.get(normalizeLabel(label)) }
}

export function resolveScheduledPlace(env: Record<string, string | undefined>, label: string | undefined): ScheduledPlaceIdentity | undefined {
  if (!label?.trim()) return undefined
  return resolveHouseholdPlaceResolver(env)?.resolve(label)
}
