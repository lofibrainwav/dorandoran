import type { NormalizedCalendarEvent } from './contracts.ts'
import {
  reconcileFactClaims,
  type FactClaim,
  type FactSourceRole,
  type ReconciledFact,
  type ReconciledFactKind,
} from './fact-reconciliation.ts'
import type { TargetedProviderFactClaim } from './provider-claim-boundary.ts'

export type CalendarFactSourceRole = Extract<FactSourceRole, 'primary_calendar' | 'family_calendar'>

export interface ReconciledCalendarEventReality {
  eventId: string
  targetEventId: string
  title: string
  protected: boolean
  allDay?: boolean
  reality: {
    start?: string
    end?: string
    location?: string
    recurrence?: string
    cancelled?: boolean
    materials?: string
  }
  facts: Partial<Record<ReconciledFactKind, ReconciledFact>>
  evidenceRefs: string[]
}
function calendarEvidence(event: NormalizedCalendarEvent) {
  const evidence = event.evidence.find((item) => item.sourceType === 'calendar')
  if (!evidence) throw new Error('CALENDAR_EVIDENCE_MISSING')
  return evidence
}

function calendarClaims(
  event: NormalizedCalendarEvent,
  sourceRole: CalendarFactSourceRole,
): FactClaim[] {
  const evidence = calendarEvidence(event)
  const claims: FactClaim[] = []
  const add = (fact: ReconciledFactKind, value: string | undefined) => {
    if (!value?.trim()) return
    claims.push({
      id: `${evidence.id}:${fact}`,
      fact,
      value: value.trim(),
      sourceRole,
      evidenceRef: evidence.id,
      observedAt: evidence.observedAt,
    })
  }
  add('start', event.start)
  add('end', event.end)
  add('location', event.location)
  add('recurrence', event.recurrence)
  return claims
}

function resolvedValue(fact: ReconciledFact | undefined): string | boolean | undefined {
  return fact?.state === 'resolved' ? fact.value : undefined
}
export function reconcileCalendarEventReality(input: {
  event: NormalizedCalendarEvent
  calendarSourceRole: CalendarFactSourceRole
  providerClaims?: Array<TargetedProviderFactClaim | null>
}): ReconciledCalendarEventReality {
  const evidence = calendarEvidence(input.event)
  const targetEventId = evidence.id
  const providerClaims = (input.providerClaims ?? []).filter(
    (claim): claim is TargetedProviderFactClaim => Boolean(claim),
  )
  if (providerClaims.some((claim) => claim.targetEventId !== targetEventId)) {
    throw new Error('FACT_CLAIM_TARGET_MISMATCH')
  }

  const allClaims: FactClaim[] = [
    ...calendarClaims(input.event, input.calendarSourceRole),
    ...providerClaims,
  ]
  const grouped = new Map<ReconciledFactKind, FactClaim[]>()
  for (const claim of allClaims) {
    const group = grouped.get(claim.fact) ?? []
    group.push(claim)
    grouped.set(claim.fact, group)
  }
  const facts: Partial<Record<ReconciledFactKind, ReconciledFact>> = {}
  for (const [fact, claims] of grouped) facts[fact] = reconcileFactClaims(claims)

  const start = resolvedValue(facts.start)
  const end = resolvedValue(facts.end)
  const location = resolvedValue(facts.location)
  const recurrence = resolvedValue(facts.recurrence)
  const cancelled = resolvedValue(facts.cancelled)
  const materials = resolvedValue(facts.materials)

  return {
    eventId: input.event.id,
    targetEventId,
    title: input.event.title,
    protected: input.event.protected !== false,
    allDay: input.event.allDay === true ? true : undefined,
    reality: {
      start: typeof start === 'string' ? start : undefined,
      end: typeof end === 'string' ? end : undefined,
      location: typeof location === 'string' ? location : undefined,
      recurrence: typeof recurrence === 'string' ? recurrence : undefined,
      cancelled: typeof cancelled === 'boolean' ? cancelled : undefined,
      materials: typeof materials === 'string' ? materials : undefined,
    },
    facts,
    evidenceRefs: [...new Set(allClaims.map((claim) => claim.evidenceRef))],
  }
}
