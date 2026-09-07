import {
  calendarSourceHealth,
  projectTemporalGrid,
  resolveLocalCalendarSourceRegistry,
  temporalGridForDisplay,
  type ContextObservation,
  type LocalCalendarSourceConfig,
  type TemporalGridDisplayProjection,
} from '../family-os/index.ts'
import {
  readGoogleCalendarSource,
  type GoogleCalendarReadWindow,
} from './google-calendar-local-transport.ts'
import { calendarPayloadsToObservations } from './private-calendar-operating-source.ts'

export type PrivateTemporalReadEvents = (
  config: LocalCalendarSourceConfig,
  window: GoogleCalendarReadWindow,
) => ReturnType<typeof readGoogleCalendarSource>

interface DateParts {
  year: number
  month: number
  day: number
}
function zonedDateParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  )
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) }
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  )
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second))
  return asUtc - date.getTime()
}
function zonedMidnightUtc(parts: DateParts, timeZone: string): Date {
  const wallClockUtc = Date.UTC(parts.year, parts.month - 1, parts.day)
  let candidate = new Date(wallClockUtc)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    candidate = new Date(wallClockUtc - timeZoneOffsetMs(candidate, timeZone))
  }
  return candidate
}

function localDateKey(parts: DateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function yearWindow(now: Date, timeZone: string): { anchorLocalDate: string; window: GoogleCalendarReadWindow } {
  const local = zonedDateParts(now, timeZone)
  return {
    anchorLocalDate: localDateKey(local),
    window: {
      start: zonedMidnightUtc({ year: local.year, month: 1, day: 1 }, timeZone),
      end: zonedMidnightUtc({ year: local.year + 1, month: 1, day: 1 }, timeZone),
    },
  }
}
export interface PrivateCalendarTemporalResult {
  source: 'live-local'
  coverage: 'timed-events'
  sourceHealth: 'green' | 'partial' | 'failure'
  loadedSourceKeys: string[]
  failedSourceKeys: string[]
  eventCount: number
  monthGrid: TemporalGridDisplayProjection
  yearGrid: TemporalGridDisplayProjection
}

export async function loadPrivateCalendarTemporalGrids(input: {
  env?: Record<string, string | undefined>
  personId: string
  now: Date
  timeZone: string
  readEvents?: PrivateTemporalReadEvents
}): Promise<PrivateCalendarTemporalResult | null> {
  const env = input.env ?? process.env
  const registry = resolveLocalCalendarSourceRegistry(env)
  const relevantSources = registry.sources.filter((source) => source.subjectIds.includes(input.personId))
  if (registry.mode === 'none' || (relevantSources.length === 0 && registry.incompleteSourceKeys.length === 0)) return null

  const { anchorLocalDate, window } = yearWindow(input.now, input.timeZone)
  const readEvents = input.readEvents ?? readGoogleCalendarSource
  const loadedSourceKeys: string[] = []
  const failedSourceKeys = [...registry.incompleteSourceKeys]
  const observations: ContextObservation[] = []
  let eventCount = 0

  for (const source of relevantSources) {
    try {
      const payloads = await readEvents(source, window)
      const observedAt = new Date().toISOString()
      const projected = calendarPayloadsToObservations(source, payloads, observedAt, input.timeZone)
      observations.push(...projected)
      eventCount += projected.length
      loadedSourceKeys.push(source.sourceKey)
    } catch {
      failedSourceKeys.push(source.sourceKey)
    }
  }

  const expectedCount = relevantSources.length + registry.incompleteSourceKeys.length
  const sourceHealth = calendarSourceHealth(expectedCount, loadedSourceKeys.length, failedSourceKeys.length)
  const common = { anchorLocalDate, timeZone: input.timeZone, observations, subjectId: input.personId }
  return {
    source: 'live-local',
    coverage: 'timed-events',
    sourceHealth,
    loadedSourceKeys,
    failedSourceKeys,
    eventCount,
    monthGrid: temporalGridForDisplay(projectTemporalGrid({ scale: 'month', ...common })),
    yearGrid: temporalGridForDisplay(projectTemporalGrid({ scale: 'year', ...common })),
  }
}
