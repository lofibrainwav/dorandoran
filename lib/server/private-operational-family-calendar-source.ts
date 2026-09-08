import {
  parseCalendarSubjectRules,
  projectFamilyOperatingPerson,
  resolveCalendarEventSubject,
  resolveOperationalFamilyCalendar,
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

function weekWindow(now: Date, timeZone: string): GoogleCalendarReadWindow {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  })
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]))
  const localNoon = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`)
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(String(parts.weekday))
  localNoon.setUTCDate(localNoon.getUTCDate() - Math.max(weekday, 0))
  const start = new Date(localNoon)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 8)
  return { start, end }
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

  try {
    const payloads = await readEvents(config, weekWindow(input.now, input.timeZone))
    const observedAt = new Date().toISOString()
    const observations = []
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
