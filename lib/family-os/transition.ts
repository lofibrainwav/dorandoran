import type { RouteProfile, TransitionAssessment } from './contracts.ts'

function median(values: number[]): number | undefined {
  if (!values.length) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function assessTransition(profile: RouteProfile): TransitionAssessment {
  const gap = profile.scheduledGapMinutes
  if (gap == null) {
    return { tightness: 'unknown', friction: 'unknown', deviation: 'unknown', routineState: 'unknown', reasons: ['SCHEDULE_GAP_UNKNOWN'] }
  }

  const observedMedian = median(profile.observedTravelMinutes)
  const baselineMid = profile.baselineTravelMinutes
    ? (profile.baselineTravelMinutes.min + profile.baselineTravelMinutes.max) / 2
    : undefined
  const expectedTravel = profile.liveTravelMinutes ?? observedMedian ?? baselineMid
  const slack = expectedTravel == null ? undefined : gap - expectedTravel

  let tightness: TransitionAssessment['tightness'] = 'unknown'
  if (profile.preferredGapMinutes != null) {
    const delta = gap - profile.preferredGapMinutes
    tightness = Math.abs(delta) <= 5 || delta < -5 ? 'high' : delta <= 15 ? 'medium' : 'low'
  } else if (expectedTravel != null) {
    const margin = gap - expectedTravel
    tightness = margin <= 5 ? 'high' : margin <= 15 ? 'medium' : 'low'
  }

  let deviation: TransitionAssessment['deviation'] = 'unknown'
  if (profile.liveTravelMinutes != null && (observedMedian != null || baselineMid != null)) {
    const baseline = observedMedian ?? baselineMid!
    const delta = profile.liveTravelMinutes - baseline
    deviation = delta <= 3 ? 'none' : delta <= 8 ? 'small' : 'meaningful'
  } else if (profile.liveTravelMinutes == null) {
    deviation = 'none'
  }

  const observedFits = profile.observedTravelMinutes.length >= 2
    && profile.observedTravelMinutes.every((minutes) => minutes <= gap)
  const expectedFits = expectedTravel == null ? undefined : expectedTravel <= gap

  let friction: TransitionAssessment['friction'] = 'unknown'
  const reasons: string[] = []
  if (expectedFits === false) {
    friction = 'high'
    reasons.push('EXPECTED_TRAVEL_EXCEEDS_GAP')
  } else if (expectedFits === true && profile.routineConfidence === 'high' && observedFits) {
    friction = 'low'
    reasons.push('FAMILY_ROUTINE_REPEATEDLY_FITS')
  } else if (expectedFits === true && profile.routineConfidence !== 'low') {
    friction = 'medium'
    reasons.push('ROUTE_FITS_BUT_ROUTINE_EVIDENCE_LIMITED')
  } else {
    reasons.push('PHYSICAL_EVIDENCE_INSUFFICIENT')
  }

  let routineState: TransitionAssessment['routineState'] = 'unknown'
  if (friction === 'high') routineState = 'friction'
  else if (tightness === 'high' && friction === 'low' && profile.routineConfidence === 'high' && observedFits) {
    routineState = 'proven_tight_fit'
  } else if (friction === 'low') routineState = 'normal_fit'
  else if (friction === 'medium' || deviation === 'meaningful') routineState = 'watch'

  return { tightness, friction, deviation, routineState, slackMinutes: slack, reasons }
}
