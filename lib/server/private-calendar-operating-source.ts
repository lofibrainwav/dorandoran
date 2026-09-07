import {
  calendarSourceHealth,
  normalizeAdapterOutput,
  normalizeGoogleCalendarApiEvent,
  projectFamilyOperatingPerson,
  resolveLocalCalendarSourceRegistry,
  weekWindowFromLocalDate,
  type ContextObservation,
  type FamilyOperatingPersonReadModel,
  type GoogleCalendarApiEventPayload,
  type LocalCalendarSourceConfig,
  type LocalWeekWindow,
  type SpecialistModuleSummary,
} from '../family-os/index.ts'
import { readGoogleCalendarSource } from './google-calendar-local-transport.ts'

export type PrivateCalendarReadEvents = (
  config: LocalCalendarSourceConfig,
  window: LocalWeekWindow,
) => Promise<GoogleCalendarApiEventPayload[]>

export interface PrivateCalendarOperatingResult {
  source: 'live-local'
  readModel: FamilyOperatingPersonReadModel
  sourceHealth: 'green' | 'partial' | 'failure'
  loadedSourceKeys: string[]
  failedSourceKeys: string[]
  eventCount: number
}
function eventObservations(
  config: LocalCalendarSourceConfig,
  payloads: GoogleCalendarApiEventPayload[],
  observedAt: string,
  timeZone: string,
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
        ...(normalized.location ? { where: { label: normalized.location } } : {}),
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
  modules?: SpecialistModuleSummary[]
  readEvents?: PrivateCalendarReadEvents
}): Promise<PrivateCalendarOperatingResult | null> {
  const env = input.env ?? process.env
  const registry = resolveLocalCalendarSourceRegistry(env)
  const relevantSources = registry.sources.filter((source) => source.subjectIds.includes(input.personId))
  if (registry.mode === 'none' || (relevantSources.length === 0 && registry.incompleteSourceKeys.length === 0)) return null

  const window = weekWindowFromLocalDate(input.now, input.timeZone)
  const readEvents = input.readEvents ?? readGoogleCalendarSource
  const loadedSourceKeys: string[] = []
  const failedSourceKeys = [...registry.incompleteSourceKeys]
  const observations: ContextObservation[] = []
  let eventCount = 0

  for (const source of relevantSources) {
    try {
      const payloads = await readEvents(source, window)
      const observedAt = new Date().toISOString()
      observations.push(...eventObservations(source, payloads, observedAt, input.timeZone))
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
  }
}
