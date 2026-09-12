import {
  calendarSourceHealth,
  normalizeAdapterOutput,
  normalizeGoogleCalendarApiEvent,
  projectFamilyOperatingPerson,
  resolveLocalCalendarSourceRegistry,
  resolveScheduledPlace,
  weekWindowFromLocalDate,
  weekWindowFromLocalWeekStart,
  type ContextObservation,
  type FamilyOperatingPersonReadModel,
  type GoogleCalendarApiEventPayload,
  type LocalCalendarSourceConfig,
  type SpecialistModuleSummary,
} from '../family-os/index.ts'
import { readGoogleCalendarSource, type GoogleCalendarReadWindow } from './google-calendar-local-transport.ts'

export type PrivateCalendarReadEvents = (
  config: LocalCalendarSourceConfig,
  window: GoogleCalendarReadWindow,
) => Promise<GoogleCalendarApiEventPayload[]>

export interface PrivateCalendarOperatingResult {
  source: 'live-local'
  readModel: FamilyOperatingPersonReadModel
  sourceHealth: 'green' | 'partial' | 'failure'
  loadedSourceKeys: string[]
  failedSourceKeys: string[]
  eventCount: number
  /** Person-scoped schedule observations inside the week window. */
  observations: ContextObservation[]
  /** Local sources are already person-scoped, so household facts equal the person observations. */
  householdObservations: ContextObservation[]
}
export function calendarPayloadsToObservations(
  config: LocalCalendarSourceConfig,
  payloads: GoogleCalendarApiEventPayload[],
  observedAt: string,
  timeZone: string,
  env: Record<string, string | undefined> = process.env,
) {
  return payloads.flatMap((payload) => {
    if (!payload.start?.dateTime || !payload.end?.dateTime) return []
    const normalized = normalizeGoogleCalendarApiEvent(payload, { calendarId: config.calendarId, observedAt })
    const evidenceRef = normalized.evidence[0]?.id
    if (!evidenceRef) return []
    const input = {
      id: `context:${evidenceRef}`,
      kind: 'schedule',
      sixW1H: {
        who: { personIds: [...config.subjectIds] },
        what: { label: normalized.title, ref: normalized.id },
        when: { start: normalized.start, end: normalized.end, timeZone },
        ...(normalized.location ? { where: { label: normalized.location, ...(resolveScheduledPlace(env, normalized.location)?.coordinates ? { coordinates: resolveScheduledPlace(env, normalized.location)?.coordinates } : {}) } } : {}),
      },
      sourceRef: evidenceRef,
      observedAt,
      evidenceState: 'confirmed' as const,
      evidenceRefs: [evidenceRef],
      continuity: { recordedAt: observedAt },
    }
    return normalizeAdapterOutput(`calendar:${config.sourceKey}`, [input])
  })
}
export async function loadPrivateCalendarOperatingPerson(input: {
  env?: Record<string, string | undefined>
  personId: string
  label: string
  now: Date
  timeZone: string
  weekStartDate?: string
  modules?: SpecialistModuleSummary[]
  readEvents?: PrivateCalendarReadEvents
}): Promise<PrivateCalendarOperatingResult | null> {
  const env = input.env ?? process.env
  const registry = resolveLocalCalendarSourceRegistry(env)
  const relevantSources = registry.sources.filter((source) => source.subjectIds.includes(input.personId))
  if (registry.mode === 'none' || (relevantSources.length === 0 && registry.incompleteSourceKeys.length === 0)) return null

  const window = input.weekStartDate
    ? weekWindowFromLocalWeekStart(input.weekStartDate, input.timeZone)
    : weekWindowFromLocalDate(input.now, input.timeZone)
  const readEvents = input.readEvents ?? readGoogleCalendarSource
  const loadedSourceKeys: string[] = []
  const failedSourceKeys = [...registry.incompleteSourceKeys]
  const observations: ContextObservation[] = []
  let eventCount = 0

  for (const source of relevantSources) {
    try {
      const payloads = await readEvents(source, window)
      const observedAt = new Date().toISOString()
      observations.push(...calendarPayloadsToObservations(source, payloads, observedAt, input.timeZone, env))
      eventCount += payloads.filter((item) => item.start?.dateTime && item.end?.dateTime).length
      loadedSourceKeys.push(source.sourceKey)
    } catch {
      failedSourceKeys.push(source.sourceKey)
    }
  }

  const expectedCount = relevantSources.length + registry.incompleteSourceKeys.length
  const sourceHealth = calendarSourceHealth(expectedCount, loadedSourceKeys.length, failedSourceKeys.length)
  const readModel = projectFamilyOperatingPerson({
    personId: input.personId,
    label: input.label,
    now: input.now.toISOString(),
    observations,
    modules: input.modules,
  })

  return {
    source: 'live-local',
    readModel,
    sourceHealth,
    loadedSourceKeys,
    failedSourceKeys,
    eventCount,
    observations,
    householdObservations: observations,
  }
}
