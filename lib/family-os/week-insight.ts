import type { TransitionAssessment } from './contracts.ts'
import type { ReconciledFactKind } from './fact-reconciliation.ts'
import type { ReconciledCalendarEventReality } from './event-reconciliation.ts'

export type WeekInsightHint =
  | 'review_transition'
  | 'recheck_route'
  | 'prepare_materials'
  | 'review_future_occurrences'
  | 'release_time_window'
  | 'recover_evidence'
  | 'route_friction'

export interface WeekEventInsight {
  eventId: string
  targetEventId: string
  title: string
  protected: boolean
  state: 'confirmed' | 'changed' | 'cancelled' | 'recover' | 'action'
  nextStep: 'none' | 'recover' | 'prepare'
  needsHumanAttention: boolean
  changeKinds: ReconciledFactKind[]
  hints: WeekInsightHint[]
  reality: ReconciledCalendarEventReality['reality']
  evidenceRefs: string[]
}

const FACT_ORDER: ReconciledFactKind[] = [
  'start', 'end', 'location', 'cancelled', 'recurrence', 'materials',
]
function pushHint(hints: WeekInsightHint[], hint: WeekInsightHint): void {
  if (!hints.includes(hint)) hints.push(hint)
}

export function projectWeekEventInsight(input: {
  reality: ReconciledCalendarEventReality
  transition?: TransitionAssessment
}): WeekEventInsight {
  const { reality, transition } = input
  const changeKinds = FACT_ORDER.filter((fact) => {
    const result = reality.facts[fact]
    return result?.state === 'resolved' && result.supersededClaimIds.length > 0
  })
  const hasConflict = FACT_ORDER.some((fact) => reality.facts[fact]?.state === 'conflict')
  const hints: WeekInsightHint[] = []

  if (changeKinds.includes('start') || changeKinds.includes('end')) pushHint(hints, 'review_transition')
  if (changeKinds.includes('location')) pushHint(hints, 'recheck_route')
  if (changeKinds.includes('materials')) pushHint(hints, 'prepare_materials')
  if (changeKinds.includes('recurrence')) pushHint(hints, 'review_future_occurrences')
  if (reality.reality.cancelled === true) pushHint(hints, 'release_time_window')
  if (hasConflict) pushHint(hints, 'recover_evidence')
  if (transition?.friction === 'high' || transition?.routineState === 'friction') {
    pushHint(hints, 'route_friction')
  }
  let state: WeekEventInsight['state'] = 'confirmed'
  let nextStep: WeekEventInsight['nextStep'] = 'none'
  if (hasConflict) {
    state = 'recover'
    nextStep = 'recover'
  } else if (reality.reality.cancelled === true) {
    state = 'cancelled'
    nextStep = 'prepare'
  } else if (transition?.friction === 'high' || transition?.routineState === 'friction') {
    state = 'action'
    nextStep = 'prepare'
  } else if (changeKinds.length > 0) {
    state = 'changed'
    nextStep = 'prepare'
  }

  return {
    eventId: reality.eventId,
    targetEventId: reality.targetEventId,
    title: reality.title,
    protected: reality.protected,
    state,
    nextStep,
    needsHumanAttention: false,
    changeKinds,
    hints,
    reality: { ...reality.reality },
    evidenceRefs: [...reality.evidenceRefs],
  }
}
