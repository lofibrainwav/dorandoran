export interface LocalCalendarRuntimeConfig {
  clientPath: string
  tokenPath: string
  calendarId: string
}

export interface LocalCalendarSourceConfig extends LocalCalendarRuntimeConfig {
  sourceKey: string
  subjectIds: string[]
}

export interface LocalCalendarSourceRegistry {
  sources: LocalCalendarSourceConfig[]
  incompleteSourceKeys: string[]
  mode: 'multi' | 'legacy' | 'none'
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function cleanList(value: string | undefined): string[] {
  return (clean(value) ?? '').split(',').map((item) => item.trim()).filter(Boolean)
}

function sourceConfig(
  env: Record<string, string | undefined>,
  sourceKey: string,
): LocalCalendarSourceConfig | null {
  const key = sourceKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  const prefix = `GOOGLE_CALENDAR_SOURCE_${key}`
  const clientPath = clean(env[`${prefix}_CLIENT_SECRET_PATH`])
  const tokenPath = clean(env[`${prefix}_TOKEN_PATH`])
  const calendarId = clean(env[`${prefix}_TARGET_ID`])
  const subjectIds = cleanList(env[`${prefix}_SUBJECT_IDS`])
  if (!clientPath || !tokenPath || !calendarId) return null
  return { sourceKey, clientPath, tokenPath, calendarId, subjectIds }
}

export function resolveLocalCalendarRuntimeConfig(
  env: Record<string, string | undefined>,
): LocalCalendarRuntimeConfig | null {
  const clientPath = clean(env.GOOGLE_CALENDAR_CLIENT_SECRET_PATH)
  const tokenPath = clean(env.GOOGLE_CALENDAR_TOKEN_PATH)
  const calendarId = clean(env.GOOGLE_CALENDAR_TARGET_ID)
  if (!clientPath || !tokenPath || !calendarId) return null
  return { clientPath, tokenPath, calendarId }
}

export function resolveLocalCalendarSourceRegistry(
  env: Record<string, string | undefined>,
): LocalCalendarSourceRegistry {
  const keys = (clean(env.GOOGLE_CALENDAR_SOURCE_KEYS) ?? '')
    .split(',').map((key) => key.trim().toLowerCase()).filter(Boolean)

  if (keys.length) {
    const sources: LocalCalendarSourceConfig[] = []
    const incompleteSourceKeys: string[] = []
    for (const key of keys) {
      const config = sourceConfig(env, key)
      if (config) sources.push(config)
      else incompleteSourceKeys.push(key)
    }
    return { sources, incompleteSourceKeys, mode: 'multi' }
  }

  const legacy = resolveLocalCalendarRuntimeConfig(env)
  if (legacy) {
    return {
      sources: [{ sourceKey: 'family', subjectIds: cleanList(env.GOOGLE_CALENDAR_SUBJECT_IDS), ...legacy }],
      incompleteSourceKeys: [],
      mode: 'legacy',
    }
  }

  return { sources: [], incompleteSourceKeys: [], mode: 'none' }
}

export function calendarSourceHealth(
  expectedCount: number,
  loadedCount: number,
  failedCount: number,
): 'green' | 'partial' | 'failure' {
  if (expectedCount > 0 && loadedCount === expectedCount && failedCount === 0) return 'green'
  if (loadedCount > 0) return 'partial'
  return 'failure'
}

export interface LocalWeekWindow {
  start: Date
  end: Date
  weekStartDate: string
}
interface CalendarDateParts {
  year: number
  month: number
  day: number
}

function zonedDateParts(date: Date, timeZone: string): CalendarDateParts {
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

function localDateKey(parts: CalendarDateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  )
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return asUtc - date.getTime()
}

function zonedMidnightUtc(parts: CalendarDateParts, timeZone: string): Date {
  const wallClockUtc = Date.UTC(parts.year, parts.month - 1, parts.day)
  let candidate = new Date(wallClockUtc)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    candidate = new Date(wallClockUtc - timeZoneOffsetMs(candidate, timeZone))
  }
  return candidate
}

export function weekWindowFromLocalDate(now: Date, timeZone: string): LocalWeekWindow {
  const local = zonedDateParts(now, timeZone)
  const localDay = new Date(Date.UTC(local.year, local.month - 1, local.day))
  const weekday = localDay.getUTCDay()
  localDay.setUTCDate(localDay.getUTCDate() - weekday)

  const weekStart = {
    year: localDay.getUTCFullYear(),
    month: localDay.getUTCMonth() + 1,
    day: localDay.getUTCDate(),
  }
  const endDay = new Date(Date.UTC(weekStart.year, weekStart.month - 1, weekStart.day + 7))
  const weekEnd = {
    year: endDay.getUTCFullYear(),
    month: endDay.getUTCMonth() + 1,
    day: endDay.getUTCDate(),
  }

  return {
    start: zonedMidnightUtc(weekStart, timeZone),
    end: zonedMidnightUtc(weekEnd, timeZone),
    weekStartDate: localDateKey(weekStart),
  }
}
