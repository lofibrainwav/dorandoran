import {
  normalizeAdapterOutput,
  normalizeGoogleCalendarApiEvent,
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
import {
  calendarWebRuntimeHealth,
  readGoogleCalendarWebSource,
  resolveGoogleCalendarWebRuntimeConfig,
  type GoogleCalendarWebRuntimeConfig,
} from './google-calendar-web-transport.ts'
import { calendarPayloadsToObservations } from './private-calendar-operating-source.ts'

export type OperationalFamilyCalendarReadEvents = (
  config: LocalCalendarSourceConfig,
  window: GoogleCalendarReadWindow,
) => Promise<GoogleCalendarApiEventPayload[]>

export type OperationalFamilyWebCalendarReadEvents = (
  config: GoogleCalendarWebRuntimeConfig,
  window: GoogleCalendarReadWindow,
) => Promise<GoogleCalendarApiEventPayload[]>

export interface PrivateOperationalFamilyCalendarResult {
  source: 'operational-family-local' | 'operational-family-web'
  readModel: FamilyOperatingPersonReadModel
  sourceHealth: 'green' | 'failure'
  eventCount: number
  unassignedEventCount: number
  /** Person-scoped timed schedule observations inside the week window; empty on failure. */
  observations: ContextObservation[]
  /**
   * Every calendar fact in the window (timed and all-day), with `who` set to the resolved person
   * or left empty when no explicit rule names one. Nothing is hidden and nothing is guessed.
   */
  householdObservations: ContextObservation[]
}

function householdObservation(input: {
  config: LocalCalendarSourceConfig
  payload: GoogleCalendarApiEventPayload
  observedAt: string
  timeZone: string
  subjectId: string | null
}): ContextObservation | null {
  let normalized
  try {
    normalized = normalizeGoogleCalendarApiEvent(input.payload, { calendarId: input.config.calendarId, observedAt: input.observedAt })
  } catch {
    return null
  }
  if (!normalized.start || !normalized.end) return null
  const startMs = Date.parse(normalized.start)
  const endMs = Date.parse(normalized.end)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null
  if (normalized.allDay && [normalized.start, normalized.end].some((date) =>
    !/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date)) return null
  const evidenceRef = normalized.evidence[0]?.id
  if (!evidenceRef || !normalized.start) return null
  return normalizeAdapterOutput(`calendar:${input.config.sourceKey}`, [{
    id: `context:${evidenceRef}`,
    kind: normalized.allDay ? 'schedule-all-day' : 'schedule',
    sixW1H: {
      who: { personIds: input.subjectId ? [input.subjectId] : [] },
      what: { label: normalized.title, ref: normalized.id },
      when: { start: normalized.start, ...(normalized.end ? { end: normalized.end } : {}), timeZone: input.timeZone },
      ...(normalized.location ? { where: { label: normalized.location } } : {}),
    },
    sourceRef: evidenceRef,
    observedAt: input.observedAt,
    evidenceState: 'confirmed' as const,
    evidenceRefs: [evidenceRef],
    continuity: { recordedAt: input.observedAt },
  }])[0] ?? null
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
  readWebEvents?: OperationalFamilyWebCalendarReadEvents
}): Promise<PrivateOperationalFamilyCalendarResult | null> {
  const env = input.env ?? process.env
  const calendarId = resolveOperationalFamilyCalendar(env)
  if (!calendarId) return null

  const webHealth = calendarWebRuntimeHealth(env)
  if (webHealth === 'incomplete') {
    return {
      source: 'operational-family-web',
      readModel: emptyReadModel(input),
      sourceHealth: 'failure',
      eventCount: 0,
      unassignedEventCount: 0,
      observations: [],
      householdObservations: [],
    }
  }

  const clientPath = clean(env.GOOGLE_CALENDAR_CLIENT_SECRET_PATH)
  const tokenPath = clean(env.GOOGLE_CALENDAR_TOKEN_PATH)
  const localReady = Boolean(clientPath && tokenPath)
  if (webHealth === 'off' && !localReady) return null

  let rules
  try {
    rules = parseCalendarSubjectRules(env)
  } catch {
    return {
      source: webHealth === 'ready' ? 'operational-family-web' : 'operational-family-local',
      readModel: emptyReadModel(input),
      sourceHealth: 'failure',
      eventCount: 0,
      unassignedEventCount: 0,
      observations: [],
      householdObservations: [],
    }
  }

  const canonicalWindow = weekWindowFromLocalDate(input.now, input.timeZone)
  const window = { start: canonicalWindow.start, end: canonicalWindow.end }
  let payloads: GoogleCalendarApiEventPayload[]
  let source: PrivateOperationalFamilyCalendarResult['source']
  let observationConfig: LocalCalendarSourceConfig

  try {
    if (webHealth === 'ready') {
      const webConfig = resolveGoogleCalendarWebRuntimeConfig(env)
      if (!webConfig) throw new Error('GOOGLE_CALENDAR_WEB_CONFIG_MISSING')
      payloads = await (input.readWebEvents ?? readGoogleCalendarWebSource)(webConfig, window)
      source = 'operational-family-web'
      observationConfig = {
        sourceKey: 'family-operations',
        clientPath: '',
        tokenPath: '',
        calendarId: webConfig.calendarId,
        subjectIds: [],
      }
    } else {
      const localConfig: LocalCalendarSourceConfig = {
        sourceKey: 'family-operations',
        clientPath: clientPath!,
        tokenPath: tokenPath!,
        calendarId,
        subjectIds: [],
      }
      payloads = await (input.readEvents ?? readGoogleCalendarSource)(localConfig, window)
      source = 'operational-family-local'
      observationConfig = localConfig
    }
  } catch {
    return {
      source: webHealth === 'ready' ? 'operational-family-web' : 'operational-family-local',
      readModel: emptyReadModel(input),
      sourceHealth: 'failure',
      eventCount: 0,
      unassignedEventCount: 0,
      observations: [],
      householdObservations: [],
    }
  }

  const observedAt = new Date().toISOString()
  const observations: ContextObservation[] = []
  const householdObservations: ContextObservation[] = []
  let eventCount = 0
  let unassignedEventCount = 0

  for (const payload of payloads) {
    const subjectId = resolveCalendarEventSubject({
      id: payload.id,
      recurringEventId: payload.recurringEventId,
      summary: payload.summary,
    }, rules)
    const fact = householdObservation({ config: observationConfig, payload, observedAt, timeZone: input.timeZone, subjectId })
    if (!fact) {
      // A skipped malformed event would make an incomplete week look complete.
      return {
        source,
        readModel: emptyReadModel(input),
        sourceHealth: 'failure',
        eventCount: 0,
        unassignedEventCount: 0,
        observations: [],
        householdObservations: [],
      }
    }
    householdObservations.push(fact)

    const hasTimes = Boolean(payload.start?.dateTime && payload.end?.dateTime)
    if (!hasTimes) continue
    if (!subjectId) {
      unassignedEventCount += 1
      continue
    }
    if (subjectId !== input.personId) continue
    observations.push(...calendarPayloadsToObservations(
      { ...observationConfig, subjectIds: [input.personId] },
      [payload],
      observedAt,
      input.timeZone,
    ))
    eventCount += 1
  }

  return {
    source,
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
    observations,
    householdObservations,
  }
}
