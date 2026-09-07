import type { ContextObservation } from './universal-context.ts'

export interface SpecialistModuleSummary {
  id: string
  label: string
}

export interface OperatingPlaceProjection {
  state: 'Scheduled' | 'Unknown'
  label?: string
  placeRef?: string
  coordinates?: { latitude: number; longitude: number }
  evidenceRefs: string[]
}

export interface OperatingTimeProjection {
  start?: string
  end?: string
  timeZone?: string
}

export interface FamilyOperatingPersonReadModel {
  id: string
  label: string
  now: string
  next: string
  nowWhen?: OperatingTimeProjection
  nextWhen?: OperatingTimeProjection
  outcome?: string
  place: OperatingPlaceProjection
  modules: SpecialistModuleSummary[]
}

export interface ProjectFamilyOperatingPersonInput {
  personId: string
  label: string
  now: string
  observations: ContextObservation[]
  modules?: SpecialistModuleSummary[]
  outcome?: string
}

function subjectObservations(observations: ContextObservation[], personId: string): ContextObservation[] {
  return observations.filter((observation) => observation.sixW1H.who?.personIds.includes(personId))
}

function startMs(observation: ContextObservation): number {
  return observation.sixW1H.when?.start ? Date.parse(observation.sixW1H.when.start) : Number.NaN
}

function endMs(observation: ContextObservation): number {
  return observation.sixW1H.when?.end ? Date.parse(observation.sixW1H.when.end) : Number.NaN
}

function timeProjection(observation?: ContextObservation): OperatingTimeProjection | undefined {
  const when = observation?.sixW1H.when
  if (!when || (!when.start && !when.end && !when.timeZone)) return undefined
  return {
    ...(when.start ? { start: when.start } : {}),
    ...(when.end ? { end: when.end } : {}),
    ...(when.timeZone ? { timeZone: when.timeZone } : {}),
  }
}

function scheduledPlace(observation?: ContextObservation): OperatingPlaceProjection {
  const where = observation?.sixW1H.where
  if (!observation || !where || (!where.label && !where.placeRef && !where.coordinates)) {
    return { state: 'Unknown', evidenceRefs: [] }
  }
  return {
    state: 'Scheduled',
    ...(where.label ? { label: where.label } : {}),
    ...(where.placeRef ? { placeRef: where.placeRef } : {}),
    ...(where.coordinates ? { coordinates: { ...where.coordinates } } : {}),
    evidenceRefs: [...observation.evidenceRefs],
  }
}

export function projectFamilyOperatingPerson(input: ProjectFamilyOperatingPersonInput): FamilyOperatingPersonReadModel {
  const nowMs = Date.parse(input.now)
  if (!Number.isFinite(nowMs)) throw new Error('valid now is required')

  const relevant = subjectObservations(input.observations, input.personId)
  const current = relevant
    .filter((observation) => Number.isFinite(startMs(observation)) && Number.isFinite(endMs(observation)))
    .filter((observation) => startMs(observation) <= nowMs && nowMs < endMs(observation))
    .sort((left, right) => startMs(right) - startMs(left))[0]

  const next = relevant
    .filter((observation) => Number.isFinite(startMs(observation)) && startMs(observation) > nowMs)
    .sort((left, right) => startMs(left) - startMs(right))[0]

  return {
    id: input.personId,
    label: input.label,
    now: current?.sixW1H.what?.label ?? 'Unknown',
    next: next?.sixW1H.what?.label ?? 'Unknown',
    ...(timeProjection(current) ? { nowWhen: timeProjection(current) } : {}),
    ...(timeProjection(next) ? { nextWhen: timeProjection(next) } : {}),
    ...(input.outcome ? { outcome: input.outcome } : {}),
    place: scheduledPlace(current),
    modules: (input.modules ?? []).map((module) => ({ ...module })),
  }
}
