import type { TimeScale } from './zoom-contract.ts'

export interface HouseholdHome {
  label: string
  latitude: number
  longitude: number
}

export interface GlobeCamera {
  center: [number, number]
  zoom: number
}

export const DEFAULT_HOUSEHOLD_HOME: HouseholdHome = { label: 'Los Angeles', latitude: 34.05, longitude: -118.24 }

/**
 * The household's home place, used only for where the globe looks by default.
 * It never becomes a presence or location claim for any person.
 * Invalid input throws; callers that render (app/family/page.tsx) log and fall back to the default.
 */
export function resolveHouseholdHome(env: Record<string, string | undefined> = process.env): HouseholdHome {
  const raw = env.DORANDORAN_HOME_COORDINATES?.trim()
  const rawLabel = env.DORANDORAN_HOME_LABEL?.trim()
  // A label without coordinates would silently mislabel the default place: treat it as a misconfiguration.
  if (!raw) {
    if (rawLabel) throw new Error('INVALID_HOUSEHOLD_HOME')
    return { ...DEFAULT_HOUSEHOLD_HOME }
  }
  const parts = raw.split(',').map((part) => part.trim())
  if (parts.length !== 2) throw new Error('INVALID_HOUSEHOLD_HOME')
  const latitude = Number(parts[0])
  const longitude = Number(parts[1])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('INVALID_HOUSEHOLD_HOME')
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('INVALID_HOUSEHOLD_HOME')
  const label = rawLabel || 'Home'
  return { label, latitude, longitude }
}

const ZOOM_BY_SCALE: Record<Exclude<TimeScale, 'past'>, number> = {
  now: 8.5,
  today: 7.8,
  week: 6.0,
  month: 4.0,
  // Year is wide enough to keep a whole continent in frame around home rather than a coast-centred half view.
  year: 2.2,
}

/** Globe camera per time scale: every scale but Past Journey centres on home; Past Journey is always the whole world. */
export function cameraForTimeScale(scale: TimeScale, home: HouseholdHome): GlobeCamera {
  if (scale === 'past') return { center: [0, 22], zoom: 1.25 }
  return { center: [home.longitude, home.latitude], zoom: ZOOM_BY_SCALE[scale] }
}
