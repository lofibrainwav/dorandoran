import type { HouseholdMember } from './google-household-identity.ts'
import {
  resolveEventResponsibility,
  resolveHouseholdResponsibilityDefaults,
  type ResponsibilityOverride,
} from './household-responsibility-policy.ts'

export type HouseholdViewMode = 'execution' | 'scheduling' | 'balanced' | 'overview'
export type HouseholdAttention = 'action' | 'manage' | 'observe'

export interface HouseholdScheduleEvent {
  id?: unknown
  recurringEventId?: unknown
  subjectPersonId: string
  title: string
  start: string
  end: string
  location?: string
}

export interface HouseholdTodayItem extends HouseholdScheduleEvent {
  transportPersonId: string | null
  schedulerPersonId: string | null
  attention: HouseholdAttention
}

export interface HouseholdTodayView {
  viewerPersonId: string
  mode: HouseholdViewMode
  items: HouseholdTodayItem[]
}

function viewerMode(viewer: HouseholdMember): HouseholdViewMode {
  const transport = viewer.roles.includes('transport')
  const scheduler = viewer.roles.includes('scheduler')
  if (transport && scheduler) return 'balanced'
  if (transport) return 'execution'
  if (scheduler) return 'scheduling'
  return 'overview'
}

function attentionForViewer(input: {
  viewerPersonId: string
  transportPersonId: string | null
  schedulerPersonId: string | null
}): HouseholdAttention {
  if (input.transportPersonId === input.viewerPersonId) return 'action'
  if (input.schedulerPersonId === input.viewerPersonId) return 'manage'
  return 'observe'
}

export function projectHouseholdTodayForViewer(input: {
  viewerPersonId: string
  membership: HouseholdMember[]
  events: HouseholdScheduleEvent[]
  overrides: ResponsibilityOverride[]
}): HouseholdTodayView {
  const viewer = input.membership.find((member) => member.personId === input.viewerPersonId)
  if (!viewer || !viewer.canSignIn) throw new Error('HOUSEHOLD_VIEWER_UNKNOWN')

  const defaults = resolveHouseholdResponsibilityDefaults(input.membership)
  const items = input.events
    .map((event) => {
      const transportPersonId = resolveEventResponsibility({
        responsibility: 'transport',
        eventId: event.id,
        recurringEventId: event.recurringEventId,
        defaults,
        overrides: input.overrides,
        membership: input.membership,
      })
      const schedulerPersonId = resolveEventResponsibility({
        responsibility: 'scheduler',
        eventId: event.id,
        recurringEventId: event.recurringEventId,
        defaults,
        overrides: input.overrides,
        membership: input.membership,
      })
      return {
        ...event,
        transportPersonId,
        schedulerPersonId,
        attention: attentionForViewer({
          viewerPersonId: viewer.personId,
          transportPersonId,
          schedulerPersonId,
        }),
      }
    })
    .sort((left, right) => Date.parse(left.start) - Date.parse(right.start))

  return {
    viewerPersonId: viewer.personId,
    mode: viewerMode(viewer),
    items,
  }
}
