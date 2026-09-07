import type {
  ExplicitCalendarAction,
  FamilyBlock,
  NormalizedCalendarEvent,
} from './contracts.ts'
import { reconcileEvidence } from './evidence.ts'

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function cleanMinutes(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function eventWorkState(event: NormalizedCalendarEvent): FamilyBlock['workState'] {
  return reconcileEvidence(event.evidence) === 'confirmed' ? 'hold' : 'open'
}

function canonicalEventIdentity(event: NormalizedCalendarEvent, eventId: string): string {
  const calendarEvidence = event.evidence.find((ref) => ref.sourceType === 'calendar' && cleanString(ref.sourceId))
  return cleanString(calendarEvidence?.sourceId) ?? eventId
}

function childBlock(
  event: NormalizedCalendarEvent,
  action: ExplicitCalendarAction,
  primaryId: string,
  eventIdentity: string,
): FamilyBlock {
  const id = `action:${eventIdentity}:${action.id}`
  const digital = action.mode === 'digital' || action.mode === 'together'
  return {
    id,
    type: 'action',
    parentBlockId: primaryId,
    reality: { title: cleanString(action.title) ?? 'Untitled action' },
    evidenceRefs: event.evidence.map((ref) => ref.id),
    evidenceState: reconcileEvidence(event.evidence),
    people: {
      subjectIds: [],
      physicalOwnerIds: action.physicalOwnerIds ?? [],
      approverIds: action.approverIds ?? [],
      recipientIds: action.recipientIds ?? [],
    },
    digital: {
      executor: digital ? 'chad' : undefined,
      jobs: action.jobId ? [{ jobId: action.jobId }] : [],
    },
    timeEngine: { protected: false, priority: action.priority },
    dependencyIds: [primaryId],
    childBlockIds: [],
    workState: 'open',
  }
}

export function decomposeCalendarEvent(event: NormalizedCalendarEvent): FamilyBlock[] {
  const eventId = cleanString(event.id)
  if (!eventId) throw new Error('INVALID_CALENDAR_EVENT_ID')
  const evidenceState = reconcileEvidence(event.evidence)
  const actions = Array.isArray(event.explicitActions) ? event.explicitActions : []
  const eventIdentity = canonicalEventIdentity(event, eventId)
  const primaryId = `event:${eventIdentity}`
  const children = actions.map((action) => childBlock(
    { ...event, id: eventId }, action, primaryId, eventIdentity,
  ))
  const primary: FamilyBlock = {
    id: primaryId,
    type: 'event',
    reality: {
      title: cleanString(event.title) ?? 'Untitled calendar event',
      start: cleanString(event.start),
      end: cleanString(event.end),
      durationMinutes: cleanMinutes(event.durationMinutes),
      location: cleanString(event.location),
      recurrence: cleanString(event.recurrence),
      allDay: event.allDay === true ? true : undefined,
    },
    evidenceRefs: event.evidence.map((ref) => ref.id),
    evidenceState,
    people: {
      subjectIds: event.subjectIds ?? [],
      physicalOwnerIds: event.physicalOwnerIds ?? [],
      approverIds: event.approverIds ?? [],
      recipientIds: event.recipientIds ?? [],
    },
    digital: { jobs: [] },
    timeEngine: { protected: event.protected ?? true },
    dependencyIds: [],
    childBlockIds: children.map((block) => block.id),
    workState: eventWorkState(event),
  }
  return [primary, ...children]
}
