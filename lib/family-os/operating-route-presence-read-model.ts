import type { TransitionAssessment } from './contracts.ts'
import type { PresenceObservation } from './universal-context.ts'

export interface OperatingPresenceProjection {
  state: 'live' | 'last_known' | 'unknown'
  label: 'Live' | 'Last known' | 'Unknown'
  placeRef?: string
  observedAt?: string
  evidenceRefs: string[]
}

export interface OperatingRouteProjection {
  state: 'clear' | 'watch' | 'friction' | 'unknown'
  routineState: TransitionAssessment['routineState']
  tightness: TransitionAssessment['tightness']
  friction: TransitionAssessment['friction']
  deviation: TransitionAssessment['deviation']
  slackMinutes?: number
  reasons: string[]
  evidenceRefs: string[]
}

function validObservedAt(value: string): boolean {
  return Number.isFinite(Date.parse(value))
}
export function projectOperatingPresence(input: PresenceObservation): OperatingPresenceProjection {
  const evidenceRefs = [...new Set(input.evidenceRefs.filter(Boolean))]
  if (!validObservedAt(input.observedAt) || evidenceRefs.length === 0) {
    return { state: 'unknown', label: 'Unknown', evidenceRefs: [] }
  }

  if (input.state === 'confirmed_live') {
    return {
      state: 'live', label: 'Live', evidenceRefs,
      ...(input.placeRef ? { placeRef: input.placeRef } : {}),
      observedAt: input.observedAt,
    }
  }
  if (input.state === 'last_known') {
    return {
      state: 'last_known', label: 'Last known', evidenceRefs,
      ...(input.placeRef ? { placeRef: input.placeRef } : {}),
      observedAt: input.observedAt,
    }
  }
  return { state: 'unknown', label: 'Unknown', evidenceRefs }
}

export function projectOperatingRoute(input: {
  assessment: TransitionAssessment
  evidenceRefs: string[]
}): OperatingRouteProjection {
  const evidenceRefs = [...new Set(input.evidenceRefs.filter(Boolean))]
  let state: OperatingRouteProjection['state'] = 'unknown'
  if (evidenceRefs.length > 0) {
    if (input.assessment.routineState === 'friction' || input.assessment.friction === 'high') state = 'friction'
    else if (input.assessment.routineState === 'watch' || input.assessment.deviation === 'meaningful') state = 'watch'
    else if (input.assessment.routineState === 'proven_tight_fit' || input.assessment.routineState === 'normal_fit') state = 'clear'
  }

  return {
    state,
    routineState: input.assessment.routineState,
    tightness: input.assessment.tightness,
    friction: input.assessment.friction,
    deviation: input.assessment.deviation,
    ...(input.assessment.slackMinutes != null ? { slackMinutes: input.assessment.slackMinutes } : {}),
    reasons: [...input.assessment.reasons],
    evidenceRefs,
  }
}
