import {
  parseCalendarSubjectRules,
  projectFamilyOperatingPerson,
  resolveCalendarEventSubject,
  resolveOperationalFamilyCalendar,
  weekWindowFromLocalDate,
  type ContextObservation,
  type FamilyOperatingPersonReadModel,
  type GoogleCalendarApiEventPayload,
  type LocalCalendarSourceConfig,
  type SpecialistModuleSummary,
} from '../family-os/index.ts'
import { readGoogleCalendarSource, type GoogleCalendarReadWindow } from './google-calendar-local-transport.ts'
import { calendarPayloadsToObservations } from './private-calendar-operating-source.ts'

export type OperationalFamilyCalendarReadEvents = (
  config: LocalCalendarSourceConfig,
  window: GoogleCalendarReadWindow,
) => Promise<GoogleCalendarApiEventPayload[]>

export interface PrivateOperationalFamilyCalendarResult {
  source: 'operational-family-local'
  readModel: FamilyOperatingPersonReadModel
  sourceHealth: 'green' | 'failure'
  eventCount: number
  unassignedEventCount: number
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function emptyReadModel(input: {
  personId: string
  label: string
  now: Date
  modules?: SpecialistModuleSummary[]
}) {
  return projectFamilyOperatingPerson({
    personId: input.personId,
    label: input.label,
    now: input.now.toISOString(),
    observations: [],
    modules: input.modules,
  })
}

export async function loadPrivateOperationalFamilyCalendarPerson(input: {
  env?: Record<string, string | undefined>
  personId: string
  label: string
  now: Date
  timeZone: string
  modules?: SpecialistModuleSummary[]
  readEvents?: OperationalFamilyCalendarReadEvents
}): Promise<PrivateOperationalFamilyCalendarResult | null> {
  const env = input.env ?? process.env
  const clientPath = clean(env.GOOGLE_CALENDAR_CLIENT_SECRET_PATH)
  const tokenPath = clean(env.GOOGLE_CALENDAR_TOKEN_PATH)
  const calendarId = resolveOperationalFamilyCalendar(env)
  if (!clientPath || !tokenPath || !calendarId) return null

  let rules
  try {
    rules = parseCalendarSubjectRules(env)
  } catch {
    return {
      source: 'operational-family-local',
      readModel: emptyReadModel(input),
      sourceHealth: 'failure',
      eventCount: 0,
      unassignedEventCount: 0,
    }
  }

  const config: LocalCalendarSourceConfig = {
    sourceKey: 'family-operations',
    clientPath,
    tokenPath,
    calendarId,
    subjectIds: [],
  }
  const readEvents = input.readEvents ?? readGoogleCalendarSource
  const canonicalWindow = weekWindowFromLocalDate(input.now, input.timeZone)

  try {
    const payloads = await readEvents(config, { start: canonicalWindow.start, end: canonicalWindow.end })
    const observedAt = new Date().toISOString()
    const observations: ContextObservation[] = []
    let eventCount = 0
    let unassignedEventCount = 0

    for (const payload of payloads) {
      const hasTimes = Boolean(payload.start?.dateTime && payload.end?.dateTime)
      if (!hasTimes) continue
      const subjectId = resolveCalendarEventSubject({
        id: payload.id,
        recurringEventId: payload.recurringEventId,
        summary: payload.summary,
      }, rules)
      if (!subjectId) {
        unassignedEventCount += 1
        continue
      }
      if (subjectId !== input.personId) continue
      observations.push(...calendarPayloadsToObservations(
        { ...config, subjectIds: [input.personId] },
        [payload],
        observedAt,
        input.timeZone,
      ))
      eventCount += 1
    }

    return {
      source: 'operational-family-local',
      readModel: projectFamilyOperatingPerson({
        personId: input.personId,
        label: input.label,
        now: input.now.toISOString(),
        observations,
        modules: input.modules,
      }),
      sourceHealth: 'green',
      eventCount,
      unassignedEventCount,
    }
  } catch {
    return {
      source: 'operational-family-local',
      readModel: emptyReadModel(input),
      sourceHealth: 'failure',
      eventCount: 0,
      unassignedEventCount: 0,
    }
  }
}
