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

function childBlock(event: NormalizedCalendarEvent, action: ExplicitCalendarAction): FamilyBlock {
  const id = `action:${event.id}:${action.id}`
  const digital = action.mode === 'digital' || action.mode === 'together'
  return {
    id,
    type: 'action',
    parentBlockId: `event:${event.id}`,
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
    dependencyIds: [`event:${event.id}`],
    childBlockIds: [],
    workState: 'open',
  }
}

export function decomposeCalendarEvent(event: NormalizedCalendarEvent): FamilyBlock[] {
  const eventId = cleanString(event.id)
  if (!eventId) throw new Error('INVALID_CALENDAR_EVENT_ID')
  const evidenceState = reconcileEvidence(event.evidence)
  const actions = Array.isArray(event.explicitActions) ? event.explicitActions : []
  const children = actions.map((action) => childBlock({ ...event, id: eventId }, action))
  const primaryId = `event:${eventId}`
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
